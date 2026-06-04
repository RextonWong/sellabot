import { useEffect, useState } from 'react';
import {
  Package, Tag, Archive, MessageSquare, Ticket, Network, Activity,
} from 'lucide-react';
import { api } from '../api/client';
import type { AgentInfo } from '../types';

const AGENT_ICONS: Record<string, React.ElementType> = {
  product:          Package,
  pricing:          Tag,
  inventory:        Archive,
  'customer-service': MessageSquare,
  promotion:        Ticket,
  orchestrator:     Network,
};

function AgentCard({ agent }: { agent: AgentInfo }) {
  const Icon = AGENT_ICONS[agent.id] ?? Activity;
  const isActive = agent.status === 'active';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon size={20} className="text-slate-600" />
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
          isActive
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-slate-100 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
          {isActive ? 'Active' : 'Idle'}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800 capitalize">{agent.label}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{agent.description}</p>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-slate-900">{agent.tasksToday}</p>
          <p className="text-xs text-slate-400">tasks today</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 font-medium">Handles</p>
          <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-32">
            {agent.handles.slice(0, 3).map((h) => (
              <span key={h} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                {h.split('.')[1] ?? h}
              </span>
            ))}
            {agent.handles.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">
                +{agent.handles.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Agents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents().then(setAgents).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          All AI agents powering Sellabot. Each owns a single workflow domain.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
