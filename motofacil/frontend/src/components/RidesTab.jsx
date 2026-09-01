import React, { useEffect, useState, useCallback } from 'react';
import { rides as ridesApi } from '../services/api';
import StatusBadge from './StatusBadge';
import RideMap from './RideMap';
import { RefreshCw } from 'lucide-react';

export default function RidesTab() {
  const [activeRides, setActiveRides] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ridesApi.active();
      setActiveRides(data);
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl">Corridas ativas</h2>
          <p className="text-sm text-ink/55 mt-0.5">{activeRides.length} em andamento agora</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm border border-ink/15 px-3 py-2 rounded-sm hover:bg-white">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      <RideMap rides={activeRides} />

      <div className="mt-5 bg-white border border-ink/10 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/55">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Motoboy</th>
              <th className="px-4 py-3 font-medium">Origem → Destino</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {activeRides.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/45">Nenhuma corrida ativa no momento.</td></tr>
            )}
            {activeRides.map((r) => (
              <tr key={r.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-medium">{r.tracking_code}</td>
                <td className="px-4 py-3">{r.client?.name || r.client?.whatsapp}</td>
                <td className="px-4 py-3">{r.driver?.name || '—'}</td>
                <td className="px-4 py-3 text-ink/70">{r.origin_address} → {r.destination_address}</td>
                <td className="px-4 py-3">R$ {r.price}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
