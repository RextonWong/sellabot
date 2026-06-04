import type { Agent, AgentContext } from '../../core/agent';
import type { Task, TaskKind, TaskResult } from '../../core/task';
import {
  ProductCreatePayloadSchema,
  ProductUpdatePayloadSchema,
  ProductDeletePayloadSchema,
} from '../../core/task';
import { ValidationError, NeedsApprovalError } from '../../core/errors';

export class ProductAgent implements Agent {
  readonly name = 'product' as const;
  readonly handles: readonly TaskKind[] = [
    'product.create',
    'product.update',
    'product.delete',
    'product.list',
  ];

  async handle(task: Task, ctx: AgentContext): Promise<TaskResult> {
    switch (task.kind) {
      case 'product.list':    return this.list(task, ctx);
      case 'product.create':  return this.create(task, ctx);
      case 'product.update':  return this.update(task, ctx);
      case 'product.delete':  return this.delete(task, ctx);
      default:
        return { status: 'failure', error: `Unknown kind: ${task.kind}`, retryable: false };
    }
  }

  private async list(task: Task, ctx: AgentContext): Promise<TaskResult> {
    await ctx.audit('API_CALL_INTENT', { task: task.kind });
    const products = await ctx.adapter.listProducts({ shopId: task.shopId });
    await ctx.audit('API_CALL_SUCCESS', { task: task.kind }, { count: products.length });
    return { status: 'success', data: products };
  }

  private async create(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = ProductCreatePayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const payload = parsed.data;
    await ctx.audit('API_CALL_INTENT', { task: task.kind, payload });

    const product = await ctx.adapter.createProduct({
      shopId: task.shopId,
      product: {
        name: payload.name,
        description: payload.description,
        categoryId: payload.categoryId,
        images: payload.images,
        price: payload.price,
        currency: payload.currency,
        stock: payload.stock,
        sku: payload.sku,
        status: 'active',
        attributes: payload.attributes ?? {},
      },
    });

    await ctx.audit('API_CALL_SUCCESS', { task: task.kind }, { itemId: product.itemId });
    ctx.logger.info({ itemId: product.itemId }, 'product created');
    return { status: 'success', data: product };
  }

  private async update(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = ProductUpdatePayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { itemId, ...updates } = parsed.data;
    await ctx.audit('API_CALL_INTENT', { task: task.kind, itemId, updates });

    await ctx.adapter.updateProduct({ shopId: task.shopId, itemId, updates });

    await ctx.audit('API_CALL_SUCCESS', { task: task.kind, itemId });
    ctx.logger.info({ itemId }, 'product updated');
    return { status: 'success', data: { itemId } };
  }

  private async delete(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = ProductDeletePayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { itemIds } = parsed.data;

    // Deletions always require approval — see CLAUDE.md §8
    throw new NeedsApprovalError(
      `Deleting ${itemIds.length} product(s) is irreversible.`,
      { itemIds },
    );
  }
}
