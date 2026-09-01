import React, { useEffect, useState } from 'react';
import { users as usersApi, admin as adminApi } from '../services/api';
import StatCard from './StatCard';

export default function UsersTab() {
  const [list, setList] = useState([]);
  const [billing, setBilling] = useState(null);

  useEffect(() => {
    usersApi.list().then(({ data }) => setList(data));
    adminApi.billing().then(({ data }) => setBilling(data));
  }, []);

  async function handleToggleBlock(id) {
    await usersApi.toggleBlock(id);
    const { data } = await usersApi.list();
    setList(data);
  }

  return (
    <div>
      <h2 className="text-xl mb-1">Usuários e faturamento</h2>
      <p className="text-sm text-ink/55 mb-5">Histórico de clientes e desempenho financeiro da plataforma</p>

      {billing && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Corridas concluídas" value={billing.totalRides} />
          <StatCard label="Faturamento bruto" value={`R$ ${billing.totalRevenue}`} />
          <StatCard label="Comissão da plataforma" value={`R$ ${billing.totalPlatformFee}`} />
          <StatCard label="Repassado a motoboys" value={`R$ ${billing.totalDriverPayout}`} />
        </div>
      )}

      <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/55">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/45">Nenhum usuário cadastrado ainda.</td></tr>
            )}
            {list.map((u) => (
              <tr key={u.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-ink/70">{u.whatsapp}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.is_blocked ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {u.is_blocked ? 'Bloqueado' : 'Ativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleBlock(u.id)}
                    className="text-xs border border-ink/15 px-2.5 py-1.5 rounded-sm hover:bg-paper"
                  >
                    {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
