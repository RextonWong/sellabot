import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, Store } from 'lucide-react';
import { api } from '../api/client';
import { usePlatform } from '../App';
import { getPlatform } from '../config/platforms';
import StatCard from '../components/ui/StatCard';
import PlatformBadge from '../components/ui/PlatformBadge';
import StatusBadge from '../components/ui/StatusBadge';
import type { DashboardStats, Task } from '../types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const { platform } = usePlatform();
  const p = getPlatform(platform);

  const [stats, setStats] = useState<DashboardStats>({ tasksToday: 0, pendingApprovals: 0, failedTasks: 0, activeShops: 0 });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.stats(platform),
      api.tasks({ platform, limit: 10 }),
    ]).then(([s, t]) => {
      setStats(s);
      setTasks(t);
    }).catch(console.error).finally(() => setLoading(false));
  }, [platform]);

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {p.name} · Today's overview
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: p.color }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          Live
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tasks Today" value={loading ? '—' : stats.tasksToday}
          icon={CheckCircle} accentColor={p.color} />
        <StatCard label="Pending Approvals" value={loading ? '—' : stats.pendingApprovals}
          icon={AlertCircle} accentColor="#F59E0B"
          sub={stats.pendingApprovals > 0 ? 'Action required' : undefined} />
        <StatCard label="Failed Tasks" value={loading ? '—' : stats.failedTasks}
          icon={XCircle} accentColor="#EF4444" />
        <StatCard label="Active Shops" value={loading ? '—' : stats.activeShops}
          icon={Store} accentColor="#10B981" />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Recent Activity</h2>
          <span className="text-xs text-slate-400">Last 10 tasks</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">No tasks yet.</p>
            <p className="text-slate-400 text-xs mt-1">Submit your first task to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <li key={task.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <PlatformBadge platform={task.platform} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{task.shopName}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {task.intent ?? task.kind}
                    {task.agent && <span className="ml-1.5 text-slate-400">· {task.agent}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={task.status} />
                  <span className="text-xs text-slate-400 w-16 text-right">{timeAgo(task.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
