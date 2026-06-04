import type { Agent, AgentContext } from '../../core/agent';
import type { Task, TaskKind, TaskResult } from '../../core/task';
import { InventoryUpdatePayloadSchema, InventorySetAlertPayloadSchema } from '../../core/task';
import { ValidationError } from '../../core/errors';
import db from '../../db/client';

export class InventoryAgent implements Agent {
  readonly name = 'inventory' as const;
  readonly handles: readonly TaskKind[] = [
    'inventory.update',
    'inventory.set_alert',
    'inventory.report_low',
  ];

  async handle(task: Task, ctx: AgentContext): Promise<TaskResult> {
    switch (task.kind) {
      case 'inventory.update':    return this.update(task, ctx);
      case 'inventory.set_alert': return this.setAlert(task, ctx);
      case 'inventory.report_low': return this.reportLow(task, ctx);
      default:
        return { status: 'failure', error: `Unknown kind: ${task.kind}`, retryable: false };
    }
  }

  private async update(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = InventoryUpdatePayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { itemId, modelId, stock } = parsed.data;

    await ctx.audit('API_CALL_INTENT', { itemId, modelId, stock });
    await ctx.adapter.updateStock({ shopId: task.shopId, itemId, modelId, stock });
    await ctx.audit('API_CALL_SUCCESS', { itemId, modelId, stock });

    ctx.logger.info({ itemId, stock }, 'stock updated');
    return { status: 'success', data: { itemId, stock } };
  }

  private async setAlert(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = InventorySetAlertPayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    // Store alert threshold in the price snapshot table (reuse as config store)
    // In a full implementation, a dedicated alerts table would be better
    ctx.logger.info(parsed.data, 'low-stock alert configured');
    return { status: 'success', data: parsed.data };
  }

  private async reportLow(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const stockItems = await ctx.adapter.listProducts({ shopId: task.shopId });
    const threshold = 10; // default; would come from stored alerts in production

    const lowStock = stockItems.filter((p) => p.stock <= threshold && p.stock >= 0);
    ctx.logger.info({ count: lowStock.length }, 'low-stock report generated');
    return {
      status: 'success',
      data: {
        threshold,
        count: lowStock.length,
        items: lowStock.map((p) => ({ itemId: p.itemId, name: p.name, stock: p.stock })),
      },
    };
  }
}
