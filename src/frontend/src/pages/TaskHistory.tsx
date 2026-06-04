import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import { usePlatform } from '../App';
import PlatformBadge from '../components/ui/PlatformBadge';
import StatusBadge from '../components/ui/StatusBadge';
import type { Task, TaskStatus } from '../types';

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'needs_approval', label: 'Needs Approval' },
  { value: 'in_progress', label: 'Running' },
  { value: 'pending', label: 'Pending' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TaskHistory() {
  const { platform } = usePlatform();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.tasks({ platform, status: statusFilter || undefined })
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [platform, statusFilter]);

  const visible = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.shopName.toLowerCase().includes(q) ||
      (t.intent ?? t.kind).toLowerCase().includes(q) ||
      (t.agent ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Task History</h1>
        <p className="text-sm text-slate-500 mt-0.5">All past tasks across your connected shops.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No tasks found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Shop</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Intent</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Agent</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={task.platform} size="sm" />
                        <span className="text-slate-800 font-medium truncate max-w-32">{task.shopName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 max-w-64">
                      <p className="truncate">{task.intent ?? task.kind}</p>
                    </td>
                    <td className="px-5 py-3">
                      {task.agent ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                          {task.agent}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={task.status as TaskStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
