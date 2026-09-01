import React, { useEffect, useState, useCallback } from 'react';
import { drivers as driversApi } from '../services/api';
import StatusBadge from './StatusBadge';
import { Check, Wallet } from 'lucide-react';

export default function DriversTab() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [walletModal, setWalletModal] = useState(null);

  const load = useCallback(async () => {
    const { data } = await driversApi.list(filter || undefined);
    setList(data);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id) {
    await driversApi.approve(id);
    load();
  }

  async function handleStatusChange(id, status) {
    await driversApi.updateStatus(id, status);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl">Motoboys</h2>
          <p className="text-sm text-ink/55 mt-0.5">Aprovação de cadastro, status e carteira</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-ink/15 rounded-sm px-3 py-2 bg-white"
        >
          <option value="">Todos os status</option>
          <option value="pending_approval">Aguardando aprovação</option>
          <option value="available">Disponível</option>
          <option value="busy">Em corrida</option>
          <option value="offline">Offline</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>

      <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/55">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Saldo</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/45">Nenhum motoboy encontrado.</td></tr>
            )}
            {list.map((d) => (
              <tr key={d.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-ink/70">{d.whatsapp}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3">R$ {d.wallet_balance}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {d.status === 'pending_approval' && (
                      <button
                        onClick={() => handleApprove(d.id)}
                        className="flex items-center gap-1 text-xs bg-brand-700 text-white px-2.5 py-1.5 rounded-sm hover:bg-brand-800"
                      >
                        <Check size={13} /> Aprovar
                      </button>
                    )}
                    {d.status !== 'pending_approval' && (
                      <select
                        value={d.status}
                        onChange={(e) => handleStatusChange(d.id, e.target.value)}
                        className="text-xs border border-ink/15 rounded-sm px-2 py-1.5"
                      >
                        <option value="available">Disponível</option>
                        <option value="busy">Em corrida</option>
                        <option value="offline">Offline</option>
                        <option value="blocked">Bloqueado</option>
                      </select>
                    )}
                    <button
                      onClick={() => setWalletModal(d)}
                      className="flex items-center gap-1 text-xs border border-ink/15 px-2.5 py-1.5 rounded-sm hover:bg-paper"
                    >
                      <Wallet size={13} /> Carteira
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {walletModal && (
        <WalletModal driver={walletModal} onClose={() => setWalletModal(null)} onSaved={load} />
      )}
    </div>
  );
}

function WalletModal({ driver, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount || !reason) return;
    setSaving(true);
    try {
      await driversApi.adjustWallet(driver.id, parseFloat(amount), reason);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-sm p-6 w-full max-w-sm">
        <h3 className="text-lg mb-1">Ajustar carteira</h3>
        <p className="text-sm text-ink/55 mb-4">{driver.name} — saldo atual: R$ {driver.wallet_balance}</p>

        <label className="block text-sm mb-1">Valor (use negativo para debitar)</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-ink/20 rounded-sm px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm mb-1">Motivo</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: recarga via Pix"
          className="w-full border border-ink/20 rounded-sm px-3 py-2 mb-6 text-sm"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-sm border border-ink/15">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-sm bg-brand-700 text-white hover:bg-brand-800"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
