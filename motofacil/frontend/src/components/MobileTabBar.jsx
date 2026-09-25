import React from 'react';
import { TABS } from './Sidebar';

// Substitui a sidebar em telas pequenas. Fixa na base, no lugar mais
// natural de alcançar com o polegar — o mesmo padrão que qualquer app de
// motorista ou entrega já ensinou o usuário a esperar.
export default function MobileTabBar({ active, onChange }) {
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                isActive ? 'text-brand-700' : 'text-ink/45'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
              <span className="leading-none">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
