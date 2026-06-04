import type { DashboardStats, Task, Shop, AgentInfo, SubmitTaskResult } from '../types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  stats: (platform?: string) =>
    request<DashboardStats>(`/api/stats${platform && platform !== 'all' ? `?platform=${platform}` : ''}`),

  tasks: (params?: { platform?: string; status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.platform && params.platform !== 'all') qs.set('platform', params.platform);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<Task[]>(`/api/tasks?${qs.toString()}`);
  },

  approveTask: (id: string) =>
    request<{ success: boolean }>(`/api/tasks/${id}/approve`, { method: 'POST' }),

  rejectTask: (id: string) =>
    request<{ success: boolean }>(`/api/tasks/${id}/reject`, { method: 'POST' }),

  submitTask: (shopId: string, intent: string) =>
    request<SubmitTaskResult>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ shopId, intent }),
    }),

  shops: (platform?: string) =>
    request<Shop[]>(`/api/shops${platform && platform !== 'all' ? `?platform=${platform}` : ''}`),

  agents: () => request<AgentInfo[]>('/api/agents'),
};
