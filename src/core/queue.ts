import { Queue, Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Task, AgentName, TaskResult } from './task';
import type { Agent, AgentContext } from './agent';
import { RetryableError, NeedsApprovalError } from './errors';
import { getAdapter } from '../platforms/registry';
import type { Logger } from 'pino';

export type TaskJob = Task;

// BullMQ bundles its own ioredis — pass connection options (not an ioredis instance)
// to avoid the dual-package type conflict.
function redisOpts(redis: Redis) {
  const opts = redis.options;
  return {
    host: opts.host ?? '127.0.0.1',
    port: opts.port ?? 6379,
    password: opts.password,
    db: opts.db ?? 0,
    maxRetriesPerRequest: null as null,
    // Required for Upstash and any rediss:// TLS connection
    tls: opts.tls ? {} : undefined,
  };
}

export function makeQueue(agentName: AgentName, redis: Redis): Queue<TaskJob> {
  return new Queue<TaskJob>(agentName, {
    connection: redisOpts(redis),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
}

export async function enqueue(
  queue: Queue<TaskJob>,
  task: Task,
): Promise<void> {
  await queue.add(task.kind, task, {
    jobId: task.idempotencyKey ?? task.id,
  });
}

export function makeWorker(
  agentName: AgentName,
  agent: Agent,
  ctx: {
    llm: AgentContext['llm'];
    logger: Logger;
    makeAudit: (taskId: string) => AgentContext['audit'];
  },
  redis: Redis,
  concurrency = 5,
): Worker<TaskJob> {
  return new Worker<TaskJob>(
    agentName,
    async (job: Job<TaskJob>) => {
      const task = job.data;
      const logger = ctx.logger.child({ taskId: task.id, kind: task.kind });
      const agentCtx: AgentContext = {
        adapter: getAdapter(task.platform),
        llm: ctx.llm,
        logger,
        audit: ctx.makeAudit(task.id),
      };

      logger.info('task started');
      const result: TaskResult = await agent.handle(task, agentCtx);

      if (result.status === 'failure' && result.retryable) {
        throw new RetryableError(result.error);
      }
      if (result.status === 'needs_approval') {
        throw new NeedsApprovalError(result.reason, result.proposedAction);
      }

      logger.info({ result }, 'task completed');
      return result;
    },
    {
      connection: redisOpts(redis),
      concurrency,
    },
  );
}
