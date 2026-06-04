import type { Agent, AgentContext } from '../../core/agent';
import type { Task, TaskKind, TaskResult } from '../../core/task';
import { CustomerServiceReplyPayloadSchema } from '../../core/task';
import { ValidationError } from '../../core/errors';
import { askForJson } from '../../llm';

export class CustomerServiceAgent implements Agent {
  readonly name = 'customer-service' as const;
  readonly handles: readonly TaskKind[] = [
    'customer_service.reply_message',
    'customer_service.reply_review',
    'customer_service.list_unanswered',
  ];

  async handle(task: Task, ctx: AgentContext): Promise<TaskResult> {
    switch (task.kind) {
      case 'customer_service.list_unanswered': return this.listUnanswered(task, ctx);
      case 'customer_service.reply_message':   return this.replyMessage(task, ctx);
      case 'customer_service.reply_review':    return this.replyReview(task, ctx);
      default:
        return { status: 'failure', error: `Unknown kind: ${task.kind}`, retryable: false };
    }
  }

  private async listUnanswered(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const conversations = await ctx.adapter.listConversations({
      shopId: task.shopId,
      unreadOnly: true,
    });
    ctx.logger.info({ count: conversations.length }, 'unanswered conversations found');
    return { status: 'success', data: conversations };
  }

  private async replyMessage(task: Task, ctx: AgentContext): Promise<TaskResult> {
    const parsed = CustomerServiceReplyPayloadSchema.safeParse(task.payload);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { conversationId, message, autoGenerate } = parsed.data;

    let replyContent = message;

    if (autoGenerate || !message) {
      const messages = await ctx.adapter.getMessages({
        shopId: task.shopId,
        conversationId,
      });

      const history = messages
        .slice(-10)
        .map((m) => `${m.senderId === 'seller' ? 'Seller' : 'Buyer'}: ${m.content}`)
        .join('\n');

      const generated = await askForJson<{ reply: string }>(
        'You are a professional and friendly Shopee seller assistant. Write a concise, helpful reply to the buyer\'s latest message. Be polite, address their concern directly, and keep it under 150 words.',
        `Conversation history:\n${history}\n\nWrite the seller's reply.`,
        '{ "reply": "string" }',
      );
      replyContent = generated.reply;
    }

    if (!replyContent) {
      return { status: 'failure', error: 'No reply content', retryable: false };
    }

    await ctx.audit('API_CALL_INTENT', { conversationId, replyContent });
    await ctx.adapter.sendMessage({
      shopId: task.shopId,
      conversationId,
      content: replyContent,
    });
    await ctx.audit('API_CALL_SUCCESS', { conversationId });

    ctx.logger.info({ conversationId }, 'message sent');
    return { status: 'success', data: { conversationId, sent: replyContent } };
  }

  private async replyReview(_task: Task, ctx: AgentContext): Promise<TaskResult> {
    // Shopee review reply API: /api/v2/product/reply_comment
    ctx.logger.info('reply_review: requires review comment API integration');
    return {
      status: 'failure',
      error: 'Review replies require Shopee comment API. Not yet implemented.',
      retryable: false,
    };
  }
}
