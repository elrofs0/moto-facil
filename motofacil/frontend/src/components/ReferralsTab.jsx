import React, { useEffect, useState, useCallback } from 'react';
import { referrals as referralsApi } from '../services/api';
import { RefreshCw, Gift, CheckCircle2 } from 'lucide-react';

function money(v) {
  return `R$ ${parseFloat(v || 0).toFixed(2)}`;
}

export default function ReferralsTab() {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await referralsApi.summary();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkPaid(driverId, driverName) {
    if (!window.confirm(`Marcar toda comissão pendente de ${driverName} como paga? Use isso depois de fazer o repasse (ex: Pix) fora do sistema.`)) {
      return;
    }
    await referralsApi.markPaid(driverId);
    load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Indicações</h2>
          <p className="mt-0.5 text-sm text-ink/55">Comissão por motoboy indicado que completa corridas</p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/75 hover:bg-white"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {summary.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/45">
          Nenhuma indicação registrada ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {summary.map(({ referrer, pendingTotal, paidTotal, commissions }) => (
            <div key={referrer.id} className="rounded-md border border-ink/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gift size={18} className="text-brand-700" />
                  <div>
                    <p className="font-medium text-ink">{referrer.name} {referrer.username ? `(@${referrer.username})` : ''}</p>
                    <p className="text-xs text-ink/55">{referrer.whatsapp}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-ink/55">Pendente</p>
                    <p className="font-medium text-ink">{money(pendingTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink/55">Já pago</p>
                    <p className="text-ink/70">{money(paidTotal)}</p>
                  </div>
                  <button
                    onClick={() => handleMarkPaid(referrer.id, referrer.name)}
                    disabled={pendingTotal <= 0}
                    className="flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 size={13} /> Marcar como pago
                  </button>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-ink/45">
                      <th className="py-1.5 pr-3 font-medium">Indicado</th>
                      <th className="py-1.5 pr-3 font-medium">Corrida</th>
                      <th className="py-1.5 pr-3 font-medium">Valor</th>
                      <th className="py-1.5 pr-3 font-medium">Status</th>
                      <th className="py-1.5 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id} className="border-b border-ink/5 last:border-0 text-ink/70">
                        <td className="py-1.5 pr-3">
                          {c.referredDriver?.name || c.referredUser?.name || '—'}
                          <span className="ml-1 text-ink/40">({c.referredDriver ? 'motoboy' : 'cliente'})</span>
                        </td>
                        <td className="py-1.5 pr-3">{c.ride?.tracking_code || '—'}</td>
                        <td className="py-1.5 pr-3">{money(c.amount)}</td>
                        <td className="py-1.5 pr-3">
                          <span className={c.status === 'paid' ? 'text-brand-700' : 'text-ember-600'}>
                            {c.status === 'paid' ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-1.5">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
