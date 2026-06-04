import { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { usePlatform } from '../App';
import PlatformBadge from '../components/ui/PlatformBadge';
import { getPlatform } from '../config/platforms';
import type { Task } from '../types';

function ProposedAction({ action }: { action: unknown }) {
  if (!action) return <span className="text-slate-400 text-sm">No details available.</span>;
  return (
    <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-slate-700">
      {JSON.stringify(action, null, 2)}
    </pre>
  );
}

export default function PendingApprovals() {
  const { platform } = usePlatform();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.tasks({ platform, status: 'needs_approval' })
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [platform]);

  async function handleAction(taskId: string, action: 'approve' | 'reject') {
    setActing(taskId);
    try {
      if (action === 'approve') await api.approveTask(taskId);
      else await api.rejectTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error(err);
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Pending Approvals</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          These tasks require your confirmation before the AI proceeds.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-400 text-sm">
          Loading…
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-green-500" />
          </div>
          <p className="text-slate-700 font-medium">All clear</p>
          <p className="text-slate-400 text-sm mt-1">No tasks awaiting approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const p = getPlatform(task.platform);
            const isActing = acting === task.id;

            return (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: p.color }}>
                  <PlatformBadge platform={task.platform} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{task.shopName}</p>
                    <p className="text-xs text-slate-500">
                      Agent: <span className="font-medium">{task.agent ?? 'unknown'}</span>
                      {' · '}
                      {new Date(task.createdAt).toLocaleString('en-MY')}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">Needs approval</span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  {task.intent && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Original Intent</p>
                      <p className="text-sm text-slate-700">"{task.intent}"</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Proposed Action</p>
                    <ProposedAction action={task.proposedAction} />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    onClick={() => handleAction(task.id, 'reject')}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction(task.id, 'approve')}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Approve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
