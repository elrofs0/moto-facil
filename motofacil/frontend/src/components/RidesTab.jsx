import React, { useEffect, useState, useCallback } from 'react';
import { rides as ridesApi } from '../services/api';
import StatusBadge from './StatusBadge';
import RideMap from './RideMap';
import { RefreshCw, XCircle } from 'lucide-react';

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

  async function handleCancel(id, trackingCode) {
    if (!window.confirm(`Cancelar a corrida ${trackingCode}? Se já tiver motoboy aceito, o lead fee é estornado e ele é avisado.`)) {
      return;
    }
    await ridesApi.cancel(id);
    load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Corridas ativas</h2>
          <p className="mt-0.5 text-sm text-ink/55">{activeRides.length} em andamento agora</p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/75 hover:bg-white"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      <RideMap rides={activeRides} />

      {activeRides.length === 0 ? (
        <p className="mt-5 rounded-md border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/45">
          Nenhuma corrida ativa no momento.
        </p>
      ) : (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-md border border-ink/10 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink/55">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Motoboy</th>
                  <th className="px-4 py-3 font-medium">Origem → Destino</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {activeRides.map((r) => (
                  <tr key={r.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{r.tracking_code}</td>
                    <td className="px-4 py-3">{r.client?.name || r.client?.whatsapp}</td>
                    <td className="px-4 py-3">{r.driver?.name || '—'}</td>
                    <td className="px-4 py-3 text-ink/70">{r.origin_address} → {r.destination_address}</td>
                    <td className="px-4 py-3">R$ {r.price}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleCancel(r.id, r.tracking_code)}
                        className="flex items-center gap-1 rounded-md border border-ember-500/30 px-2.5 py-1.5 text-xs text-ember-600 hover:bg-ember-500/10"
                      >
                        <XCircle size={13} /> Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-3 md:hidden">
            {activeRides.map((r) => (
              <div key={r.id} className="rounded-md border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{r.tracking_code}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 text-sm text-ink/70">
                  {r.origin_address} → {r.destination_address}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <p className="text-ink/55">
                    {r.client?.name || r.client?.whatsapp} · {r.driver?.name || 'sem motoboy'}
                  </p>
                  <p className="font-medium text-ink">R$ {r.price}</p>
                </div>
                <button
                  onClick={() => handleCancel(r.id, r.tracking_code)}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-ember-500/30 px-3 py-1.5 text-xs text-ember-600 hover:bg-ember-500/10"
                >
                  <XCircle size={13} /> Cancelar corrida
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
