import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import RidesTab from '../components/RidesTab';
import DriversTab from '../components/DriversTab';
import UsersTab from '../components/UsersTab';

export default function Dashboard({ onLogout }) {
  const [tab, setTab] = useState('rides');

  return (
    <div className="min-h-screen flex bg-paper">
      <Sidebar active={tab} onChange={setTab} onLogout={onLogout} />
      <main className="flex-1 p-8 overflow-y-auto">
        {tab === 'rides' && <RidesTab />}
        {tab === 'drivers' && <DriversTab />}
        {tab === 'users' && <UsersTab />}
      </main>
    </div>
  );
}
