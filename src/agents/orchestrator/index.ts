import type { Agent, AgentContext } from '../../core/agent';
import type { Task, TaskKind, TaskResult } from '../../core/task';
import { OrchestratorDispatchPayloadSchema } from '../../core/task';
import { ValidationError } from '../../core/errors';
import { askForJson } from '../../llm';
import { makeQueue, enqueue } from '../../core/queue';
import type { Redis } from 'ioredis';

interface DecomposedTask {
  kind: string;
  payload: unknown;
  rationale: string;
}

interface OrchestratorPlan {
  tasks: DecomposedTask[];
  summary: string;
}

export class OrchestratorAgent implements Agent {
  readonly name = 'orchestrator' as const;
  readonly handles: readonly TaskKind[] = ['orchestrator.dispatch'];

  constructor(private readonly redis: Redis) {}

  async handle(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = OrchestratorDispatchPayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { intent } = parsed.data;
    ctx.logger.info({ intent }, 'orchestrator decomposing intent');

    const plan = await this.decompose(intent, task.shopId, ctx);

    ctx.logger.info({ taskCount: plan.tasks.length, summary: plan.summary }, 'plan created');

    const enqueued: string[] = [];
    for (const subtask of plan.tasks) {
      const kind = subtask.kind as TaskKind;
      const queue = makeQueue(this.agentForKind(kind), this.redis);
      const newTask: Task = {
        id: `${task.id}-${enqueued.length}`,
        shopId: task.shopId,
        platform: task.platform,
        kind,
        payload: subtask.payload,
        parentTaskId: task.id,
        attempt: 0,
      };
      await enqueue(queue, newTask);
      enqueued.push(newTask.id);
    }

    return {
      status: 'success',
      data: {
        summary: plan.summary,
        subtaskIds: enqueued,
        subtaskCount: enqueued.length,
      },
    };
  }

  private async decompose(intent: string, shopId: string, ctx: AgentContext): Promise<OrchestratorPlan> {
    return askForJson<OrchestratorPlan>(
      `You are the orchestrator for Sellabot, an AI system that automates Shopee seller operations.
Your job is to decompose a natural-language seller intent into a list of typed tasks.

Available task kinds and their payload shapes:
- "product.list"      — {}
- "product.create"    — { name, description, categoryId, images[], price, stock, currency?, sku?, weight?, attributes? }
- "product.update"    — { itemId, name?, description?, images?, attributes? }
- "product.delete"    — { itemIds: string[] }
- "pricing.update"    — { itemId, price, currency?, modelId? }
- "inventory.update"  — { itemId, stock, modelId? }
- "inventory.set_alert" — { itemId, threshold }
- "inventory.report_low" — {}
- "customer_service.list_unanswered" — {}
- "customer_service.reply_message"   — { conversationId, autoGenerate: true }
- "promotion.create_voucher" — { name, discountType, discountValue, startTime, endTime, minSpend?, usageLimit? }

Rules:
- Only use the task kinds listed above.
- If the intent is ambiguous, create a safe read-only task (e.g. list/report).
- Never invent item IDs — use "UNKNOWN" if not provided and note it in the rationale.`,
      `Shop ID: ${shopId}\nSeller intent: "${intent}"\n\nDecompose into tasks.`,
      JSON.stringify({
        tasks: [{ kind: 'string', payload: 'object', rationale: 'string' }],
        summary: 'string',
      }),
    );
  }

  private agentForKind(kind: TaskKind): 'product' | 'pricing' | 'inventory' | 'customer-service' | 'promotion' {
    if (kind.startsWith('product.')) return 'product';
    if (kind.startsWith('pricing.')) return 'pricing';
    if (kind.startsWith('inventory.')) return 'inventory';
    if (kind.startsWith('customer_service.')) return 'customer-service';
    if (kind.startsWith('promotion.')) return 'promotion';
    throw new Error(`Cannot route task kind: ${kind}`);
  }
}
