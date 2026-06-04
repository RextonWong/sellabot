import type { Agent, AgentContext } from '../../core/agent';
import type { Task, TaskKind, TaskResult } from '../../core/task';
import { PromotionCreateVoucherPayloadSchema } from '../../core/task';
import { ValidationError } from '../../core/errors';

export class PromotionAgent implements Agent {
  readonly name = 'promotion' as const;
  readonly handles: readonly TaskKind[] = [
    'promotion.create_voucher',
    'promotion.join_campaign',
    'promotion.boost_listing',
  ];

  async handle(task: Task, ctx: AgentContext): Promise<TaskResult> {
    switch (task.kind) {
      case 'promotion.create_voucher': return this.createVoucher(task, ctx);
      case 'promotion.join_campaign':  return this.joinCampaign(task, ctx);
      case 'promotion.boost_listing':  return this.boostListing(task, ctx);
      default:
        return { status: 'failure', error: `Unknown kind: ${task.kind}`, retryable: false };
    }
  }

  private async createVoucher(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = PromotionCreateVoucherPayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const p = parsed.data;
    await ctx.audit('API_CALL_INTENT', { task: task.kind, ...p });

    const voucher = await ctx.adapter.createVoucher({
      shopId: task.shopId,
      voucher: {
        name: p.name,
        discountType: p.discountType,
        discountValue: p.discountValue,
        minSpend: p.minSpend ?? 0,
        usageLimit: p.usageLimit ?? 0,
        startTime: new Date(p.startTime),
        endTime: new Date(p.endTime),
      },
    });

    await ctx.audit('API_CALL_SUCCESS', { task: task.kind }, { voucherId: voucher.voucherId });
    ctx.logger.info({ voucherId: voucher.voucherId }, 'voucher created');
    return { status: 'success', data: voucher };
  }

  private async joinCampaign(_task: Task, ctx: AgentContext): Promise<TaskResult> {
    ctx.logger.info('join_campaign: requires Shopee campaign enrollment API');
    return {
      status: 'failure',
      error: 'Campaign enrollment requires Shopee campaign API. Not yet implemented.',
      retryable: false,
    };
  }

  private async boostListing(_task: Task, ctx: AgentContext): Promise<TaskResult> {
    ctx.logger.info('boost_listing: requires Shopee ads/boost API');
    return {
      status: 'failure',
      error: 'Listing boost requires Shopee Ads API. Not yet implemented.',
      retryable: false,
    };
  }
}
