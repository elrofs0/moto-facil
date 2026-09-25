import React, { useEffect, useState, useCallback } from 'react';
import { rides as ridesApi } from '../services/api';
import { RefreshCw, XCircle, CalendarClock } from 'lucide-react';

function formatScheduledFor(value) {
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ScheduledTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ridesApi.scheduled();
      setList(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // agendamentos não mudam a cada segundo — 30s já é sobra
    return () => clearInterval(interval);
  }, [load]);

  async function handleCancel(id, trackingCode) {
    if (!window.confirm(`Cancelar o agendamento da corrida ${trackingCode}?`)) return;
    await ridesApi.cancel(id);
    load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Agendamentos</h2>
          <p className="mt-0.5 text-sm text-ink/55">{list.length} corrida(s) marcada(s) pra horário futuro</p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/75 hover:bg-white"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/45">
          Nenhum agendamento pendente no momento.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-ink/10 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink/55">
                  <th className="px-4 py-3 font-medium">Agendado pra</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Motoboy preferido</th>
                  <th className="px-4 py-3 font-medium">Origem → Destino</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={14} className="text-brand-700" />
                        {formatScheduledFor(r.scheduled_for)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.tracking_code}</td>
                    <td className="px-4 py-3">{r.client?.name || r.client?.whatsapp}</td>
                    <td className="px-4 py-3">{r.preferredDriver ? `@${r.preferredDriver.username}` : '—'}</td>
                    <td className="px-4 py-3 text-ink/70">{r.origin_address} → {r.destination_address}</td>
                    <td className="px-4 py-3">R$ {r.price}</td>
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
            {list.map((r) => (
              <div key={r.id} className="rounded-md border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <CalendarClock size={14} className="text-brand-700" />
                    {formatScheduledFor(r.scheduled_for)}
                  </span>
                  <p className="text-sm text-ink/55">{r.tracking_code}</p>
                </div>
                <p className="mt-2 text-sm text-ink/70">
                  {r.origin_address} → {r.destination_address}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <p className="text-ink/55">
                    {r.client?.name || r.client?.whatsapp}
                    {r.preferredDriver ? ` · @${r.preferredDriver.username}` : ''}
                  </p>
                  <p className="font-medium text-ink">R$ {r.price}</p>
                </div>
                <button
                  onClick={() => handleCancel(r.id, r.tracking_code)}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-ember-500/30 px-3 py-1.5 text-xs text-ember-600 hover:bg-ember-500/10"
                >
                  <XCircle size={13} /> Cancelar agendamento
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
