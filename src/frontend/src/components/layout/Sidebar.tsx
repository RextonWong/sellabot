import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Send, History, Bell, Store, Bot,
  ChevronDown, Bot as BotIcon, Menu, X,
} from 'lucide-react';
import { PLATFORMS, getPlatform } from '../../config/platforms';
import { usePlatform } from '../../App';

const NAV = [
  { label: 'Overview', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/submit', icon: Send, label: 'Submit Task' },
  ]},
  { label: 'Tasks', items: [
    { to: '/history', icon: History, label: 'Task History' },
    { to: '/approvals', icon: Bell, label: 'Pending Approvals' },
  ]},
  { label: 'Setup', items: [
    { to: '/shops', icon: Store, label: 'Shops' },
    { to: '/agents', icon: Bot, label: 'Agents' },
  ]},
];

export default function Sidebar() {
  const { platform, setPlatform } = usePlatform();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = getPlatform(platform);

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-white w-60 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: current.color }}>
          <BotIcon size={16} />
        </div>
        <span className="font-semibold text-base tracking-tight">Sellabot</span>
      </div>

      {/* Platform Switcher */}
      <div className="px-3 py-3 border-b border-slate-800 relative">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center shrink-0"
              style={{ backgroundColor: current.color }}
            >
              {current.initials === 'All' ? '★' : current.initials}
            </span>
            <span className="text-sm font-medium text-slate-200 truncate">{current.name}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>

        {pickerOpen && (
          <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPlatform(p.id); setPickerOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${
                  p.id === platform ? 'bg-slate-700' : ''
                }`}
              >
                <span
                  className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.initials === 'All' ? '★' : p.initials}
                </span>
                <span className="text-slate-200">{p.name}</span>
                {p.id === platform && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin space-y-4">
        {NAV.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {section.label}
            </p>
            {section.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: `${current.color}22`, color: current.color } : {}
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-[11px] text-slate-500">Sellabot v0.1.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{content}</div>

      {/* Mobile toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center text-white" style={{ backgroundColor: current.color }}>
            <BotIcon size={14} />
          </div>
          <span className="text-white font-semibold text-sm">Sellabot</span>
        </div>
        <button onClick={() => setMobileOpen((o) => !o)} className="text-slate-400 hover:text-white">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div onClick={() => setMobileOpen(false)} className="flex-1 bg-black/50" />
          <div className="absolute left-0 top-0 bottom-0">{content}</div>
        </div>
      )}
    </>
  );
}
