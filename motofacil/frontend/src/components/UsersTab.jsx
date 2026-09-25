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
      <h2 className="font-display text-xl text-ink">Usuários e faturamento</h2>
      <p className="mt-1 mb-5 text-sm text-ink/55">
        Histórico de clientes e desempenho financeiro da plataforma
      </p>

      {billing && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Corridas concluídas" value={billing.totalRides} accent="ink" />
          <StatCard label="Movimentado entre clientes e motoboys" value={`R$ ${billing.totalRideValue}`} accent="ink" />
          <StatCard label="Receita da MotoFácil (leads)" value={`R$ ${billing.totalLeadFees}`} accent="brand" />
          <StatCard label="Recarregado pelos motoboys" value={`R$ ${billing.totalRecharges}`} accent="ember" />
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/45">
          Nenhum usuário cadastrado ainda.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-ink/10 bg-white md:block">
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
                {list.map((u) => (
                  <tr key={u.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-ink/70">{u.whatsapp}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${u.is_blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.is_blocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        {u.is_blocked ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleBlock(u.id)}
                        className="rounded-md border border-ink/15 px-2.5 py-1.5 text-xs hover:bg-paper"
                      >
                        {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {list.map((u) => (
              <div key={u.id} className="rounded-md border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-sm text-ink/55">{u.whatsapp}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${u.is_blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.is_blocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    {u.is_blocked ? 'Bloqueado' : 'Ativo'}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleBlock(u.id)}
                  className="mt-3 rounded-md border border-ink/15 px-3 py-1.5 text-xs hover:bg-paper"
                >
                  {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
