import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import Sidebar, { TABS } from '../components/Sidebar';
import MobileTabBar from '../components/MobileTabBar';
import RidesTab from '../components/RidesTab';
import ScheduledTab from '../components/ScheduledTab';
import DriversTab from '../components/DriversTab';
import MapTab from '../components/MapTab';
import UsersTab from '../components/UsersTab';
import ReferralsTab from '../components/ReferralsTab';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard({ onLogout }) {
  const [tab, setTab] = useState('rides');
  const activeLabel = TABS.find((t) => t.id === tab)?.label;

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar active={tab} onChange={setTab} onLogout={onLogout} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo — cumprimento e logout no desktop; marca e logout no mobile */}
        <header className="flex items-center justify-between border-b border-ink/10 bg-paper/90 px-5 py-4 backdrop-blur md:px-8 md:py-5">
          <div>
            <p className="hidden text-sm text-ink/55 md:block">
              {greeting()} — {activeLabel}
            </p>
            <p className="font-display text-lg text-ink md:hidden">MotoFácil</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-ink/55 hover:text-ink md:hidden"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
          <p className="hidden text-xs text-ink/40 md:block">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          {tab === 'rides' && <RidesTab />}
          {tab === 'scheduled' && <ScheduledTab />}
          {tab === 'drivers' && <DriversTab />}
          {tab === 'map' && <MapTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'referrals' && <ReferralsTab />}
        </main>
      </div>

      <MobileTabBar active={tab} onChange={setTab} />
    </div>
  );
}
