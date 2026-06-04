import { z } from 'zod';

// ── Agent names ───────────────────────────────────────────────────────────────

export const AGENT_NAMES = [
  'orchestrator',
  'product',
  'pricing',
  'inventory',
  'customer-service',
  'promotion',
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

// ── Task kinds ────────────────────────────────────────────────────────────────

export const TASK_KINDS = [
  // Product
  'product.create',
  'product.update',
  'product.delete',
  'product.list',
  // Pricing
  'pricing.update',
  'pricing.match_competitor',
  'pricing.schedule_flash_deal',
  // Inventory
  'inventory.update',
  'inventory.set_alert',
  'inventory.report_low',
  // Customer service
  'customer_service.reply_message',
  'customer_service.reply_review',
  'customer_service.list_unanswered',
  // Promotion
  'promotion.create_voucher',
  'promotion.join_campaign',
  'promotion.boost_listing',
  // Orchestrator
  'orchestrator.dispatch',
] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

// ── Task status ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'needs_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

// ── Core task envelope ────────────────────────────────────────────────────────

export interface Task<TPayload = unknown> {
  id: string;
  shopId: string;
  platform: string;
  kind: TaskKind;
  payload: TPayload;
  idempotencyKey?: string;
  parentTaskId?: string;
  /** Zero-based attempt number (0 = first attempt). */
  attempt: number;
}

// ── Task result ───────────────────────────────────────────────────────────────

export type TaskResult<TData = unknown> =
  | { status: 'success'; data: TData }
  | { status: 'failure'; error: string; retryable: boolean }
  | { status: 'needs_approval'; reason: string; proposedAction: unknown };

// ── Typed payloads per task kind ──────────────────────────────────────────────

export const ProductCreatePayloadSchema = z.object({
  name: z.string(),
  description: z.string(),
  categoryId: z.number(),
  images: z.array(z.string()),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  currency: z.string().default('SGD'),
  sku: z.string().optional(),
  weight: z.number().optional(),
  attributes: z.record(z.unknown()).optional(),
});
export type ProductCreatePayload = z.infer<typeof ProductCreatePayloadSchema>;

export const ProductUpdatePayloadSchema = z.object({
  itemId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional(),
});
export type ProductUpdatePayload = z.infer<typeof ProductUpdatePayloadSchema>;

export const ProductDeletePayloadSchema = z.object({
  itemIds: z.array(z.string()),
});
export type ProductDeletePayload = z.infer<typeof ProductDeletePayloadSchema>;

export const PricingUpdatePayloadSchema = z.object({
  itemId: z.string(),
  modelId: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('SGD'),
});
export type PricingUpdatePayload = z.infer<typeof PricingUpdatePayloadSchema>;

export const PricingMatchCompetitorPayloadSchema = z.object({
  itemId: z.string(),
  strategy: z.enum(['match', 'undercut']),
  undercutAmount: z.number().optional(),
});
export type PricingMatchCompetitorPayload = z.infer<
  typeof PricingMatchCompetitorPayloadSchema
>;

export const InventoryUpdatePayloadSchema = z.object({
  itemId: z.string(),
  modelId: z.string().optional(),
  stock: z.number().int().nonnegative(),
});
export type InventoryUpdatePayload = z.infer<typeof InventoryUpdatePayloadSchema>;

export const InventorySetAlertPayloadSchema = z.object({
  itemId: z.string(),
  threshold: z.number().int().nonnegative(),
});
export type InventorySetAlertPayload = z.infer<typeof InventorySetAlertPayloadSchema>;

export const CustomerServiceReplyPayloadSchema = z.object({
  conversationId: z.string(),
  message: z.string().optional(),
  autoGenerate: z.boolean().default(true),
});
export type CustomerServiceReplyPayload = z.infer<
  typeof CustomerServiceReplyPayloadSchema
>;

export const PromotionCreateVoucherPayloadSchema = z.object({
  name: z.string(),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().positive(),
  minSpend: z.number().nonnegative().optional(),
  usageLimit: z.number().int().positive().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});
export type PromotionCreateVoucherPayload = z.infer<
  typeof PromotionCreateVoucherPayloadSchema
>;

export const OrchestratorDispatchPayloadSchema = z.object({
  intent: z.string(),
});
export type OrchestratorDispatchPayload = z.infer<
  typeof OrchestratorDispatchPayloadSchema
>;
