import 'dotenv/config';
import { Redis } from 'ioredis';
import pino from 'pino';
import { config, shopeeConfigured } from './config';
import db from './db/client';
import { AuditLogger } from './core/audit';
import { RateLimiter } from './core/ratelimit';
import { makeWorker } from './core/queue';
import { CredentialStore } from './services/credential-store';
import { TokenRefresher } from './services/token-refresher';
import { ShopeeClient } from './platforms/shopee/client';
import { ShopeeAuth } from './platforms/shopee/auth';
import { ShopeeAdapter } from './platforms/shopee/adapter';
import { registerAdapter } from './platforms/registry';
import { ProductAgent } from './agents/product';
import { PricingAgent } from './agents/pricing';
import { InventoryAgent } from './agents/inventory';
import { CustomerServiceAgent } from './agents/customer-service';
import { PromotionAgent } from './agents/promotion';
import { OrchestratorAgent } from './agents/orchestrator';
import { ShopRepository } from './db/repositories/shops';
import { createServer } from './api/server';
import { llm } from './llm';

async function main() {
  const logger = pino({
    level: config.logLevel,
    transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
  });

  logger.info({ env: config.nodeEnv }, 'sellabot starting');

  // ── Infrastructure ────────────────────────────────────────────────────────

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const rateLimiter = new RateLimiter(redis);
  const auditLogger = new AuditLogger(db);
  const credStore = new CredentialStore(db);

  // ── Shopee platform (only when credentials are configured) ────────────────

  let shopeeAuth: ShopeeAuth | null = null;
  let stopRefresher = () => {};

  if (shopeeConfigured(config)) {
    const shopeeClient = new ShopeeClient(config.shopee, rateLimiter);
    shopeeAuth = new ShopeeAuth(config.shopee, shopeeClient);
    const shopeeAdapter = new ShopeeAdapter(shopeeClient, credStore);
    registerAdapter(shopeeAdapter);

    const refresher = new TokenRefresher(credStore, shopeeAuth, logger.child({ service: 'token-refresher' }));
    stopRefresher = refresher.startSchedule();

    logger.info('shopee adapter registered');
  } else {
    logger.warn('SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY not set — Shopee adapter disabled');
  }

  // ── Agent workers ─────────────────────────────────────────────────────────

  const makeCtx = (agentName: string, shopId?: string) => ({
    llm,
    logger: logger.child({ agent: agentName }),
    makeAudit: (taskId: string) => async (action: string, payload: unknown, outcome?: unknown) => {
      if (!shopId) return;
      await auditLogger.log({
        shopId,
        taskId,
        action: action as never,
        agent: agentName,
        payload,
        outcome,
      });
    },
  });

  const agents = [
    { agent: new ProductAgent(),            name: 'product' as const },
    { agent: new PricingAgent(),            name: 'pricing' as const },
    { agent: new InventoryAgent(),          name: 'inventory' as const },
    { agent: new CustomerServiceAgent(),    name: 'customer-service' as const },
    { agent: new PromotionAgent(),          name: 'promotion' as const },
    { agent: new OrchestratorAgent(redis),  name: 'orchestrator' as const },
  ];

  const workers = agents.map(({ agent, name }) =>
    makeWorker(name, agent, makeCtx(name), redis),
  );

  logger.info({ count: workers.length }, 'agent workers started');

  // ── HTTP server ───────────────────────────────────────────────────────────

  const shopRepo = new ShopRepository(db);
  const app = createServer({ shopeeAuth, credStore, shopRepo, redis, logger });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'http server listening');
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────

  async function shutdown(signal: string) {
    logger.info({ signal }, 'shutting down');
    stopRefresher();
    server.close();
    await Promise.all(workers.map((w) => w.close()));
    await redis.quit();
    await db.$disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
