import type { Agent, AgentContext } from '../../core/agent';
import type { Task, TaskKind, TaskResult } from '../../core/task';
import { PricingUpdatePayloadSchema, PricingMatchCompetitorPayloadSchema } from '../../core/task';
import { ValidationError, NeedsApprovalError } from '../../core/errors';

// Price changes beyond this % from current price require approval
const APPROVAL_THRESHOLD_PCT = 0.15;

export class PricingAgent implements Agent {
  readonly name = 'pricing' as const;
  readonly handles: readonly TaskKind[] = [
    'pricing.update',
    'pricing.match_competitor',
    'pricing.schedule_flash_deal',
  ];

  async handle(task: Task, ctx: AgentContext): Promise<TaskResult> {
    switch (task.kind) {
      case 'pricing.update':           return this.update(task, ctx);
      case 'pricing.match_competitor': return this.matchCompetitor(task, ctx);
      case 'pricing.schedule_flash_deal': return this.scheduleFlashDeal(task, ctx);
      default:
        return { status: 'failure', error: `Unknown kind: ${task.kind}`, retryable: false };
    }
  }

  private async update(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = PricingUpdatePayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { itemId, modelId, price } = parsed.data;

    // Check how big the price change is
    const currentProduct = await ctx.adapter.getProduct({ shopId: task.shopId, itemId });
    const currentPrice = currentProduct.models?.find((m) => m.modelId === modelId)?.price
      ?? currentProduct.price;

    if (currentPrice > 0) {
      const changePct = Math.abs(price - currentPrice) / currentPrice;
      if (changePct > APPROVAL_THRESHOLD_PCT) {
        throw new NeedsApprovalError(
          `Price change of ${(changePct * 100).toFixed(1)}% exceeds the ${APPROVAL_THRESHOLD_PCT * 100}% threshold.`,
          { itemId, currentPrice, newPrice: price, changePct },
        );
      }
    }

    await ctx.audit('API_CALL_INTENT', { itemId, modelId, price });
    await ctx.adapter.updatePrice({ shopId: task.shopId, itemId, modelId, price });
    await ctx.audit('API_CALL_SUCCESS', { itemId, modelId, price });

    ctx.logger.info({ itemId, price }, 'price updated');
    return { status: 'success', data: { itemId, price } };
  }

  private async matchCompetitor(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = PricingMatchCompetitorPayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { itemId, strategy, undercutAmount = 0 } = parsed.data;

    // Note: actual competitor price lookup requires Shopee's price comparison API
    // or a separate monitoring mechanism. Here we surface the intent.
    ctx.logger.info({ itemId, strategy }, 'match_competitor: feature requires competitor data source');
    return {
      status: 'failure',
      error: 'Competitor price matching requires a configured data source. Not yet implemented.',
      retryable: false,
    };
  }

  private async scheduleFlashDeal(task: Task, ctx: AgentContext): Promise<TaskResult> {
    // Flash deal scheduling requires Shopee shop campaign enrollment
    ctx.logger.info('schedule_flash_deal: requires Shopee campaign API integration');
    return {
      status: 'failure',
      error: 'Flash deal scheduling requires Shopee campaign API. Not yet implemented.',
      retryable: false,
    };
  }
}
