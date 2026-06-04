import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
type TaskStatus = Prisma.TaskCreateInput['status'] extends { set: infer S } ? S : never;
import type { Task, TaskResult, TaskKind } from '../../core/task';

export class TaskRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(task: Task): Promise<void> {
    await this.db.task.create({
      data: {
        id: task.id,
        shopId: task.shopId,
        kind: task.kind,
        payload: task.payload as never,
        idempotencyKey: task.idempotencyKey ?? null,
        parentTaskId: task.parentTaskId ?? null,
        status: 'PENDING',
      },
    });
  }

  async updateStatus(
    taskId: string,
    status: TaskStatus,
    extra?: { result?: TaskResult; errorMessage?: string },
  ): Promise<void> {
    await this.db.task.update({
      where: { id: taskId },
      data: {
        status,
        result: (extra?.result ?? undefined) as never,
        errorMessage: extra?.errorMessage,
        startedAt: status === 'IN_PROGRESS' ? new Date() : undefined,
        completedAt:
          status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined,
        queuedAt: status === 'QUEUED' ? new Date() : undefined,
      },
    });
  }

  async incrementAttempts(taskId: string): Promise<void> {
    await this.db.task.update({
      where: { id: taskId },
      data: { attempts: { increment: 1 } },
    });
  }

  async findById(taskId: string) {
    return this.db.task.findUnique({ where: { id: taskId } });
  }

  async findPendingByShop(shopId: string, kind?: TaskKind) {
    return this.db.task.findMany({
      where: {
        shopId,
        kind: kind ?? undefined,
        status: { in: ['PENDING', 'QUEUED'] },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
