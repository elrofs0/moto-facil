import React from 'react';
import { Map, MapPin, Bike, Users, Gift, CalendarClock, LogOut } from 'lucide-react';

export const TABS = [
  { id: 'rides', label: 'Corridas ativas', icon: Map },
  { id: 'scheduled', label: 'Agendamentos', icon: CalendarClock },
  { id: 'drivers', label: 'Motoboys', icon: Bike },
  { id: 'map', label: 'Mapa', icon: MapPin },
  { id: 'users', label: 'Usuários e faturamento', icon: Users },
  { id: 'referrals', label: 'Indicações', icon: Gift },
];

// Sidebar fixa — visível a partir de telas médias/grandes. No mobile, a
// navegação vira uma barra inferior (ver MobileTabBar.jsx), então esta
// versão pode ser confortável e mais descritiva sem se preocupar com
// espaço apertado.
export default function Sidebar({ active, onChange, onLogout }) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-brand-800 text-paper">
      <div className="px-6 py-6 border-b border-white/10">
        <p className="font-display text-xl">MotoFácil</p>
        <p className="mt-0.5 text-xs text-brand-100/65">Painel administrativo</p>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-brand-700 font-medium text-paper'
                  : 'text-brand-100/80 hover:bg-brand-700/50 hover:text-paper'
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
        className="flex items-center gap-3 border-t border-white/10 px-6 py-4 text-sm text-brand-100/70 transition-colors hover:text-paper"
      >
        <LogOut size={16} strokeWidth={1.75} /> Sair
      </button>
    </aside>
  );
}
