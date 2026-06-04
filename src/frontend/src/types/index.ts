export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'needs_approval'
  | 'approved'
  | 'rejected';

export interface Shop {
  id: string;
  platform: string;
  name: string;
  region: string;
  active: boolean;
  tokenStatus: 'active' | 'expired';
  lastConnectedAt?: string;
}

export interface Task {
  id: string;
  shopId: string;
  shopName: string;
  platform: string;
  kind: string;
  intent?: string;
  agent?: string;
  status: TaskStatus;
  result?: unknown;
  errorMessage?: string;
  proposedAction?: unknown;
  createdAt: string;
  completedAt?: string;
}

export interface AgentInfo {
  id: string;
  label: string;
  description: string;
  handles: string[];
  status: 'active' | 'idle';
  tasksToday: number;
  platform: string; // 'all' = works across all platforms
}

export interface DashboardStats {
  tasksToday: number;
  pendingApprovals: number;
  failedTasks: number;
  activeShops: number;
}

export interface SubmitTaskResult {
  taskId: string;
  message: string;
}
