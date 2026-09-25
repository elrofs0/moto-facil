import React, { useEffect, useState, useCallback } from 'react';
import { drivers as driversApi } from '../services/api';
import DriverMap from './DriverMap';
import { RefreshCw } from 'lucide-react';

export default function MapTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await driversApi.list('available');
      setList(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // atualiza a cada 15s
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Mapa</h2>
          <p className="mt-0.5 text-sm text-ink/55">Motoboys/motogirls disponíveis agora, por localização</p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/75 hover:bg-white"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      <DriverMap drivers={list} />
    </div>
  );
}
