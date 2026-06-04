import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type AuditAction = Prisma.AuditLogCreateInput['action'];

export class AuditLogger {
  constructor(private readonly db: PrismaClient) {}

  async log(params: {
    shopId: string;
    taskId?: string;
    action: AuditAction;
    agent: string;
    payload: unknown;
    outcome?: unknown;
  }): Promise<void> {
    await this.db.auditLog.create({
      data: {
        shopId: params.shopId,
        taskId: params.taskId ?? null,
        action: params.action,
        agent: params.agent,
        payload: params.payload as never,
        outcome: (params.outcome ?? null) as never,
      },
    });
  }
}
