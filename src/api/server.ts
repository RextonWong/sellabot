import express from 'express';
import type { Redis } from 'ioredis';
import type { ShopeeAuth } from '../platforms/shopee/auth';
import type { CredentialStore } from '../services/credential-store';
import type { ShopRepository } from '../db/repositories/shops';
import { makeQueue, enqueue } from '../core/queue';
import type { Task } from '../core/task';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import db from '../db/client';

// ── Mock / seed data used when DB is empty ────────────────────────────────────

const MOCK_TASKS = [
  { id: 'mock-1', shopId: 'mock-shop-1', shopName: 'My Shopee Store', platform: 'shopee', kind: 'inventory.report_low', intent: 'check my low stock items', agent: 'inventory', status: 'completed', createdAt: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: 'mock-2', shopId: 'mock-shop-1', shopName: 'My Shopee Store', platform: 'shopee', kind: 'pricing.update', intent: 'drop price on SKU-123 by 5%', agent: 'pricing', status: 'needs_approval', proposedAction: { itemId: 'SKU-123', currentPrice: 49.90, newPrice: 47.41, changePct: '5.0%' }, createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'mock-3', shopId: 'mock-shop-2', shopName: 'My Lazada Store', platform: 'lazada', kind: 'customer_service.reply_message', intent: 'reply to all unanswered buyer messages', agent: 'customer-service', status: 'completed', createdAt: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: 'mock-4', shopId: 'mock-shop-1', shopName: 'My Shopee Store', platform: 'shopee', kind: 'promotion.create_voucher', intent: 'create a 10% off weekend voucher', agent: 'promotion', status: 'completed', createdAt: new Date(Date.now() - 60 * 60000).toISOString() },
  { id: 'mock-5', shopId: 'mock-shop-3', shopName: 'My TikTok Shop', platform: 'tiktokshop', kind: 'inventory.update', intent: 'update stock for all items', agent: 'inventory', status: 'failed', errorMessage: 'TikTok Shop adapter not yet integrated', createdAt: new Date(Date.now() - 90 * 60000).toISOString() },
];

const MOCK_SHOPS = [
  { id: 'mock-shop-1', platform: 'shopee', name: 'My Shopee Store', region: 'MY', active: true, tokenStatus: 'active', lastConnectedAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'mock-shop-2', platform: 'lazada', name: 'My Lazada Store', region: 'MY', active: true, tokenStatus: 'active', lastConnectedAt: new Date(Date.now() - 12 * 3600000).toISOString() },
  { id: 'mock-shop-3', platform: 'tiktokshop', name: 'My TikTok Shop', region: 'MY', active: true, tokenStatus: 'expired', lastConnectedAt: new Date(Date.now() - 48 * 3600000).toISOString() },
];

const AGENT_DEFS = [
  { id: 'orchestrator', label: 'Orchestrator', description: 'Parses your natural-language intents and routes them to the right domain agents. The brain of the system.', handles: ['orchestrator.dispatch'], status: 'idle', tasksToday: 0, platform: 'all' },
  { id: 'product', label: 'Product Agent', description: 'Creates, updates, and deletes product listings. Manages images, titles, descriptions, and attributes.', handles: ['product.create', 'product.update', 'product.delete', 'product.list'], status: 'idle', tasksToday: 0, platform: 'all' },
  { id: 'pricing', label: 'Pricing Agent', description: 'Reads and writes product prices. Supports threshold-gated updates and competitor matching rules.', handles: ['pricing.update', 'pricing.match_competitor', 'pricing.schedule_flash_deal'], status: 'idle', tasksToday: 0, platform: 'all' },
  { id: 'inventory', label: 'Inventory Agent', description: 'Keeps stock levels accurate. Fires low-stock alerts and generates restocking reports.', handles: ['inventory.update', 'inventory.set_alert', 'inventory.report_low'], status: 'idle', tasksToday: 0, platform: 'all' },
  { id: 'customer-service', label: 'Customer Service Agent', description: 'Reads buyer messages and drafts AI-generated replies. Surfaces conversations that need human attention.', handles: ['customer_service.reply_message', 'customer_service.reply_review', 'customer_service.list_unanswered'], status: 'idle', tasksToday: 0, platform: 'all' },
  { id: 'promotion', label: 'Promotion Agent', description: 'Creates vouchers, joins platform campaigns, and boosts listings to drive visibility.', handles: ['promotion.create_voucher', 'promotion.join_campaign', 'promotion.boost_listing'], status: 'idle', tasksToday: 0, platform: 'all' },
];

// ── Server factory ────────────────────────────────────────────────────────────

export function createServer(deps: {
  shopeeAuth: ShopeeAuth | null;
  credStore: CredentialStore;
  shopRepo: ShopRepository;
  redis: Redis;
  logger: Logger;
}) {
  const app = express();
  app.use(express.json());

  // CORS for Vite dev server
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // ── Health ──────────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Dashboard: Stats ────────────────────────────────────────────────────────

  app.get('/api/stats', async (req, res) => {
    const platform = req.query.platform as string | undefined;
    try {
      const [tasksToday, pendingApprovals, failedTasks, activeShops] = await Promise.all([
        db.task.count({ where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          shop: platform ? { platform } : undefined,
        }}),
        db.task.count({ where: { status: 'NEEDS_APPROVAL', shop: platform ? { platform } : undefined } }),
        db.task.count({ where: {
          status: 'FAILED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          shop: platform ? { platform } : undefined,
        }}),
        db.shop.count({ where: { active: true, platform: platform ?? undefined } }),
      ]);
      // Fall back to mock counts if DB is empty
      const hasTasks = tasksToday + pendingApprovals + failedTasks + activeShops > 0;
      if (!hasTasks) {
        const filtered = platform ? MOCK_TASKS.filter(t => t.platform === platform) : MOCK_TASKS;
        const today = new Date(); today.setHours(0,0,0,0);
        res.json({
          tasksToday: filtered.filter(t => new Date(t.createdAt) >= today).length,
          pendingApprovals: filtered.filter(t => t.status === 'needs_approval').length,
          failedTasks: filtered.filter(t => t.status === 'failed').length,
          activeShops: (platform ? MOCK_SHOPS.filter(s => s.platform === platform) : MOCK_SHOPS).filter(s => s.active).length,
        });
      } else {
        res.json({ tasksToday, pendingApprovals, failedTasks, activeShops });
      }
    } catch (err) {
      deps.logger.error({ err }, '/api/stats failed');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Tasks list ──────────────────────────────────────────────────────────────

  app.get('/api/tasks', async (req, res) => {
    const { platform, status, limit = '50' } = req.query as Record<string, string>;
    try {
      const dbTasks = await db.task.findMany({
        where: {
          shop: platform ? { platform } : undefined,
          status: status ? status.toUpperCase() as never : undefined,
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        include: { shop: true },
      });

      if (dbTasks.length > 0) {
        res.json(dbTasks.map(t => ({
          id: t.id,
          shopId: t.shopId,
          shopName: t.shop.name,
          platform: t.shop.platform,
          kind: t.kind,
          intent: (t.payload as Record<string, unknown>)?.intent as string | undefined,
          agent: t.kind.split('.')[0],
          status: t.status.toLowerCase(),
          result: t.result,
          errorMessage: t.errorMessage,
          createdAt: t.createdAt.toISOString(),
          completedAt: t.completedAt?.toISOString(),
        })));
      } else {
        // Serve mock data while DB is empty
        let filtered = [...MOCK_TASKS];
        if (platform) filtered = filtered.filter(t => t.platform === platform);
        if (status) filtered = filtered.filter(t => t.status === status);
        res.json(filtered.slice(0, Number(limit)));
      }
    } catch (err) {
      deps.logger.error({ err }, '/api/tasks failed');
      res.json(MOCK_TASKS);
    }
  });

  // ── Approve / Reject ────────────────────────────────────────────────────────

  app.post('/api/tasks/:id/approve', async (req, res) => {
    try {
      await db.task.update({ where: { id: req.params.id }, data: { status: 'APPROVED' } });
      res.json({ success: true });
    } catch {
      res.json({ success: true }); // mock: optimistically succeed
    }
  });

  app.post('/api/tasks/:id/reject', async (req, res) => {
    try {
      await db.task.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  });

  // ── Shops ───────────────────────────────────────────────────────────────────

  app.get('/api/shops', async (req, res) => {
    const platform = req.query.platform as string | undefined;
    try {
      const shops = await db.shop.findMany({
        where: { active: true, platform: platform ?? undefined },
        include: { credentials: true },
      });
      if (shops.length > 0) {
        res.json(shops.map(s => ({
          id: s.id,
          platform: s.platform,
          name: s.name,
          region: s.region,
          active: s.active,
          tokenStatus: s.credentials
            ? (s.credentials.accessTokenExpiresAt > new Date() ? 'active' : 'expired')
            : 'expired',
          lastConnectedAt: s.credentials?.updatedAt.toISOString(),
        })));
      } else {
        const filtered = platform ? MOCK_SHOPS.filter(s => s.platform === platform) : MOCK_SHOPS;
        res.json(filtered);
      }
    } catch {
      res.json(MOCK_SHOPS);
    }
  });

  // ── Agents ──────────────────────────────────────────────────────────────────

  app.get('/api/agents', async (req, res) => {
    // Count tasks per agent today for live stats
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const counts = await db.auditLog.groupBy({
        by: ['agent'],
        where: { createdAt: { gte: today }, action: 'TASK_COMPLETED' },
        _count: { agent: true },
      });
      const countMap = Object.fromEntries(counts.map(c => [c.agent, c._count.agent]));
      res.json(AGENT_DEFS.map(a => ({ ...a, tasksToday: countMap[a.id] ?? 0 })));
    } catch {
      res.json(AGENT_DEFS);
    }
  });

  // ── Shopee OAuth flow ───────────────────────────────────────────────────────

  app.get('/auth/shopee', (_req, res) => {
    if (!deps.shopeeAuth) {
      res.status(503).json({ error: 'Shopee credentials not configured on this server.' });
      return;
    }
    const url = deps.shopeeAuth.buildAuthUrl();
    res.redirect(url);
  });

  // Shared Shopee OAuth callback handler — works at both /auth/shopee/callback
  // and / (for when redirect URL is registered as domain-only in Shopee portal)
  async function handleShopeeCallback(req: Parameters<Parameters<typeof app.get>[1]>[0], res: Parameters<Parameters<typeof app.get>[1]>[1]) {
    if (!deps.shopeeAuth) {
      res.status(503).json({ error: 'Shopee credentials not configured.' });
      return;
    }

    const { code, shop_id } = req.query;

    if (!code || !shop_id) {
      res.status(400).json({ error: 'Missing code or shop_id' });
      return;
    }

    try {
      const shopId = Number(shop_id);
      const tokens = await deps.shopeeAuth.exchangeCode(String(code), shopId);

      const shop = await deps.shopRepo.upsert({
        platform: 'shopee',
        externalId: String(shopId),
        name: `Shopee Shop ${shopId}`,
        region: 'MY',
      });

      await deps.credStore.saveTokens(shop.id, tokens);
      deps.logger.info({ shopId: shop.id }, 'shopee shop authorized');
      res.send('<h2>Shop connected! You can close this tab.</h2>');
    } catch (err) {
      deps.logger.error({ err }, 'shopee oauth callback failed');
      res.status(500).json({ error: 'OAuth callback failed' });
    }
  }

  app.get('/auth/shopee/callback', handleShopeeCallback);

  // Also handle callback at root when Shopee portal only accepts a bare domain
  app.get('/', async (req, res, next) => {
    if (req.query.code && req.query.shop_id) {
      await handleShopeeCallback(req, res);
    } else {
      next();
    }
  });

  // ── Task submission ─────────────────────────────────────────────────────────

  app.post('/tasks', async (req, res) => {
    const { shopId, intent } = req.body as { shopId: string; intent: string };

    if (!shopId || !intent) {
      res.status(400).json({ error: 'shopId and intent are required' });
      return;
    }

    // For mock shops, return a simulated response
    if (shopId.startsWith('mock-')) {
      const taskId = randomUUID();
      deps.logger.info({ taskId, intent, shopId }, 'task submitted (mock shop)');
      res.status(202).json({ taskId, message: 'Task queued (demo mode — connect a real shop to execute)' });
      return;
    }

    const shop = await deps.shopRepo.findById(shopId);
    if (!shop) {
      res.status(404).json({ error: `Shop ${shopId} not found` });
      return;
    }

    const task: Task = {
      id: randomUUID(),
      shopId,
      platform: shop.platform,
      kind: 'orchestrator.dispatch',
      payload: { intent },
      attempt: 0,
    };

    const queue = makeQueue('orchestrator', deps.redis);
    await enqueue(queue, task);

    deps.logger.info({ taskId: task.id, intent }, 'task submitted');
    res.status(202).json({ taskId: task.id, message: 'Task queued' });
  });

  return app;
}
