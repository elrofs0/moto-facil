import React from 'react';
import { Map, Bike, Users, LogOut } from 'lucide-react';

const TABS = [
  { id: 'rides', label: 'Corridas ativas', icon: Map },
  { id: 'drivers', label: 'Motoboys', icon: Bike },
  { id: 'users', label: 'Usuários e faturamento', icon: Users },
];

export default function Sidebar({ active, onChange, onLogout }) {
  return (
    <aside className="w-60 bg-brand-800 text-paper flex flex-col shrink-0">
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl">MotoFácil</h1>
        <p className="text-xs text-brand-100/70 mt-0.5">Painel administrativo</p>
      </div>

      <nav className="flex-1 py-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm text-left transition-colors ${
                isActive ? 'bg-brand-700 font-medium' : 'hover:bg-brand-700/50 text-brand-100/85'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <button
        onClick={onLogout}
        className="flex items-center gap-3 px-6 py-4 text-sm text-brand-100/70 hover:text-paper border-t border-white/10"
      >
        <LogOut size={16} strokeWidth={1.75} /> Sair
      </button>
    </aside>
  );
}
