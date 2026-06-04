import type { TaskStatus } from '../../types';

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending:          'bg-slate-100 text-slate-600',
  queued:           'bg-blue-50 text-blue-600',
  in_progress:      'bg-blue-100 text-blue-700',
  completed:        'bg-green-50 text-green-700',
  failed:           'bg-red-50 text-red-700',
  needs_approval:   'bg-amber-50 text-amber-700',
  approved:         'bg-green-100 text-green-800',
  rejected:         'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending:          'Pending',
  queued:           'Queued',
  in_progress:      'Running',
  completed:        'Completed',
  failed:           'Failed',
  needs_approval:   'Needs Approval',
  approved:         'Approved',
  rejected:         'Rejected',
};

const STATUS_DOTS: Record<TaskStatus, string> = {
  pending:          'bg-slate-400',
  queued:           'bg-blue-500',
  in_progress:      'bg-blue-600 animate-pulse',
  completed:        'bg-green-500',
  failed:           'bg-red-500',
  needs_approval:   'bg-amber-500',
  approved:         'bg-green-600',
  rejected:         'bg-slate-400',
};

interface Props {
  status: TaskStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
