import type { Logger } from 'pino';
import type { Task, TaskKind, TaskResult, AgentName } from './task';
import type { PlatformAdapter } from '../platforms/types';
import type { LLMClient } from '../llm';

export interface AgentContext {
  adapter: PlatformAdapter;
  llm: LLMClient;
  logger: Logger;
  /** Write an audit entry. Resolves when written. */
  audit(action: string, payload: unknown, outcome?: unknown): Promise<void>;
}

export interface Agent {
  readonly name: AgentName;
  readonly handles: readonly TaskKind[];
  handle(task: Task, ctx: AgentContext): Promise<TaskResult>;
}
