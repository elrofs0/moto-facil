import React, { useEffect, useState, useCallback } from 'react';
import { drivers as driversApi } from '../services/api';
import StatusBadge from './StatusBadge';
import { Check, Wallet, Plus, ShieldCheck, ShieldAlert, FileText, X, Pencil } from 'lucide-react';

export default function DriversTab() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [walletModal, setWalletModal] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [docsModal, setDocsModal] = useState(null);
  const [editModal, setEditModal] = useState(null);

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

  async function handleApproveAlvara(id) {
    await driversApi.approveAlvara(id);
    load();
  }

  const statusOptions = [
    { value: 'available', label: 'Disponível' },
    { value: 'busy', label: 'Em corrida' },
    { value: 'offline', label: 'Offline' },
    { value: 'blocked', label: 'Bloqueado' },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-ink">Motoboys</h2>
          <p className="mt-0.5 text-sm text-ink/55">Cadastro, aprovação, carteira e autorização de passageiro</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="pending_approval">Aguardando aprovação</option>
            <option value="available">Disponível</option>
            <option value="busy">Em corrida</option>
            <option value="offline">Offline</option>
            <option value="blocked">Bloqueado</option>
          </select>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-sm text-white hover:bg-brand-800"
          >
            <Plus size={15} /> Novo motoboy
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/45">
          Nenhum motoboy encontrado.
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
                  <th className="px-4 py-3 font-medium">Passageiro</th>
                  <th className="px-4 py-3 font-medium">Saldo</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-ink/70">{d.whatsapp}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3">
                      <PassengerAuthCell driver={d} onApprove={() => handleApproveAlvara(d.id)} />
                    </td>
                    <td className="px-4 py-3">R$ {d.wallet_balance}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {d.status === 'pending_approval' && (
                          <button
                            onClick={() => handleApprove(d.id)}
                            className="flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1.5 text-xs text-white hover:bg-brand-800"
                          >
                            <Check size={13} /> Aprovar
                          </button>
                        )}
                        {d.status !== 'pending_approval' && (
                          <select
                            value={d.status}
                            onChange={(e) => handleStatusChange(d.id, e.target.value)}
                            className="rounded-md border border-ink/15 px-2 py-1.5 text-xs"
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => setWalletModal(d)}
                          className="flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs hover:bg-paper"
                        >
                          <Wallet size={13} /> Carteira
                        </button>
                        <button
                          onClick={() => setDocsModal(d)}
                          className="flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs hover:bg-paper"
                        >
                          <FileText size={13} /> Documentos
                        </button>
                        <button
                          onClick={() => setEditModal(d)}
                          className="flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs hover:bg-paper"
                        >
                          <Pencil size={13} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {list.map((d) => (
              <div key={d.id} className="rounded-md border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{d.name}</p>
                    <p className="text-sm text-ink/55">{d.whatsapp}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <div className="mt-2">
                  <PassengerAuthCell driver={d} onApprove={() => handleApproveAlvara(d.id)} />
                </div>
                <p className="mt-2 font-display text-lg text-ink">R$ {d.wallet_balance}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.status === 'pending_approval' && (
                    <button
                      onClick={() => handleApprove(d.id)}
                      className="flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs text-white hover:bg-brand-800"
                    >
                      <Check size={13} /> Aprovar
                    </button>
                  )}
                  {d.status !== 'pending_approval' && (
                    <select
                      value={d.status}
                      onChange={(e) => handleStatusChange(d.id, e.target.value)}
                      className="rounded-md border border-ink/15 px-2 py-1.5 text-xs"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => setWalletModal(d)}
                    className="flex items-center gap-1 rounded-md border border-ink/15 px-3 py-1.5 text-xs hover:bg-paper"
                  >
                    <Wallet size={13} /> Carteira
                  </button>
                  <button
                    onClick={() => setDocsModal(d)}
                    className="flex items-center gap-1 rounded-md border border-ink/15 px-3 py-1.5 text-xs hover:bg-paper"
                  >
                    <FileText size={13} /> Documentos
                  </button>
                  <button
                    onClick={() => setEditModal(d)}
                    className="flex items-center gap-1 rounded-md border border-ink/15 px-3 py-1.5 text-xs hover:bg-paper"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {walletModal && (
        <WalletModal driver={walletModal} onClose={() => setWalletModal(null)} onSaved={load} />
      )}
      {createModalOpen && (
        <CreateDriverModal onClose={() => setCreateModalOpen(false)} onCreated={load} />
      )}
      {docsModal && (
        <DocumentsModal
          driver={docsModal}
          onClose={() => setDocsModal(null)}
          onApproveAlvara={() => handleApproveAlvara(docsModal.id)}
        />
      )}
      {editModal && (
        <EditDriverModal driver={editModal} onClose={() => setEditModal(null)} onSaved={load} />
      )}
    </div>
  );
}

// Mostra de forma direta se aquele motoboy pode ou não pegar corrida de
// passageiro — é a pergunta que mais importa checar antes de mandar
// alguém pra rua atender mototáxi.
function PassengerAuthCell({ driver, onApprove }) {
  if (!driver.atende_passageiro) {
    return <span className="text-xs text-ink/35">—</span>;
  }
  if (driver.autorizadoPrefeitura) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <ShieldCheck size={14} /> Autorizado
      </span>
    );
  }
  if (driver.hasAlvaraDocument) {
    return (
      <button
        onClick={onApprove}
        className="inline-flex items-center gap-1 rounded-md bg-ember-500 px-2 py-1 text-xs font-medium text-white hover:bg-ember-600"
      >
        <ShieldAlert size={13} /> Aprovar alvará
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink/45">
      <ShieldAlert size={13} /> Sem alvará
    </span>
  );
}

function CreateDriverModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [gender, setGender] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [atendeEntregas, setAtendeEntregas] = useState(true);
  const [atendePassageiro, setAtendePassageiro] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setError(null);
    if (!name || !whatsapp) {
      setError('Nome e WhatsApp são obrigatórios.');
      return;
    }
    if (!pixKey.trim()) {
      setError('Chave Pix é obrigatória — é assim que o motoboy recebe do cliente direto.');
      return;
    }
    if (!gender) {
      setError('Selecione se é motoboy ou motogirl.');
      return;
    }
    setSaving(true);
    try {
      await driversApi.create({
        name,
        whatsapp: whatsapp.replace(/\D/g, ''), // só dígitos, com DDI — mesmo formato usado no resto do sistema
        pixKey: pixKey.trim(),
        gender,
        plate: plate || undefined,
        model: model || undefined,
        atendeEntregas,
        atendePassageiro,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui cadastrar. Confira o WhatsApp (pode já estar em uso).');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 px-4 sm:items-center">
      <div className="w-full max-w-sm rounded-t-lg bg-white p-6 sm:rounded-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg text-ink">Novo motoboy</h3>
        <p className="mt-1 mb-5 text-sm text-ink/55">
          Cadastro direto — já nasce aprovado. Ele recebe um aviso de boas-vindas no WhatsApp na hora.
        </p>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1.5 block text-sm text-ink/75">Nome completo</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        />

        <label className="mb-1.5 block text-sm text-ink/75">WhatsApp (com DDD)</label>
        <input
          type="text"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="55 55 91234-5678"
          className="mb-4 w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        />

        <label className="mb-1.5 block text-sm text-ink/75">Chave Pix</label>
        <input
          type="text"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="CPF, celular, e-mail ou chave aleatória"
          className="mb-4 w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        />

        <label className="mb-1.5 block text-sm text-ink/75">Motoboy ou motogirl?</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="mb-4 w-full rounded-md border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        >
          <option value="">Selecione</option>
          <option value="motoboy">Motoboy</option>
          <option value="motogirl">Motogirl</option>
        </select>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-ink/75">Placa</label>
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              className="w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-ink/75">Modelo</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="CG 160"
              className="w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
            />
          </div>
        </div>

        <p className="mb-1.5 text-sm text-ink/75">Serviços</p>
        <label className="mb-2 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={atendeEntregas} onChange={(e) => setAtendeEntregas(e.target.checked)} />
          Entregas
        </label>
        <label className="mb-6 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={atendePassageiro} onChange={(e) => setAtendePassageiro(e.target.checked)} />
          Passageiro (mototáxi) — ainda vai precisar do alvará aprovado
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edição dos dados cadastrais básicos — corrige um cadastro feito errado
// (ex: nome digitado errado) sem precisar mexer direto no banco. Não mexe
// em status/saldo/aprovação/documentos, que já têm fluxo próprio na tabela.
function EditDriverModal({ driver, onClose, onSaved }) {
  const [name, setName] = useState(driver.name);
  const [whatsapp, setWhatsapp] = useState(driver.whatsapp);
  const [pixKey, setPixKey] = useState(driver.pix_key || '');
  const [gender, setGender] = useState(driver.gender || '');
  const [atendeEntregas, setAtendeEntregas] = useState(driver.atende_entregas);
  const [atendePassageiro, setAtendePassageiro] = useState(driver.atende_passageiro);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setError(null);
    if (!name.trim() || !whatsapp.trim()) {
      setError('Nome e WhatsApp são obrigatórios.');
      return;
    }
    if (!pixKey.trim()) {
      setError('Chave Pix é obrigatória — é assim que o motoboy recebe do cliente direto.');
      return;
    }
    if (!gender) {
      setError('Selecione se é motoboy ou motogirl.');
      return;
    }
    setSaving(true);
    try {
      await driversApi.update(driver.id, {
        name: name.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        pixKey: pixKey.trim(),
        gender,
        atendeEntregas,
        atendePassageiro,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 px-4 sm:items-center">
      <div className="w-full max-w-sm rounded-t-lg bg-white p-6 sm:rounded-md max-h-[90vh] overflow-y-auto">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink">Editar motoboy</h3>
          <button onClick={onClose} className="text-ink/45 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 mb-5 text-sm text-ink/55">
          Corrige dados cadastrais. Status, saldo e aprovações continuam nas ações da tabela.
        </p>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1.5 block text-sm text-ink/75">Nome completo</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        />

        <label className="mb-1.5 block text-sm text-ink/75">WhatsApp (com DDD)</label>
        <input
          type="text"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="55 55 91234-5678"
          className="mb-4 w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        />

        <label className="mb-1.5 block text-sm text-ink/75">Chave Pix</label>
        <input
          type="text"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="CPF, celular, e-mail ou chave aleatória"
          className="mb-4 w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        />

        <label className="mb-1.5 block text-sm text-ink/75">Motoboy ou motogirl?</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="mb-4 w-full rounded-md border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
        >
          <option value="">Selecione</option>
          <option value="motoboy">Motoboy</option>
          <option value="motogirl">Motogirl</option>
        </select>

        <p className="mb-1.5 text-sm text-ink/75">Serviços</p>
        <label className="mb-2 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={atendeEntregas} onChange={(e) => setAtendeEntregas(e.target.checked)} />
          Entregas
        </label>
        <label className="mb-6 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={atendePassageiro} onChange={(e) => setAtendePassageiro(e.target.checked)} />
          Passageiro (mototáxi)
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Revisão dos documentos de verificação (CNH, CRLV, selfie, alvará) —
// busca o conteúdo real sob demanda (driversApi.documents), já que a
// listagem geral só traz "tem ou não tem" pra não pesar a consulta.
function DocumentsModal({ driver, onClose, onApproveAlvara }) {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    driversApi.documents(driver.id).then(({ data }) => setDocs(data)).finally(() => setLoading(false));
  }, [driver.id]);

  async function handleApprove() {
    setApproving(true);
    try {
      await onApproveAlvara();
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 px-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-md">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink">Documentos — {driver.name}</h3>
          <button onClick={onClose} className="text-ink/45 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-ink/55">Carregando…</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-ink/55">Número da CNH</p>
              <p className="font-medium text-ink">{docs.cnh_numero || 'Não informado'}</p>
            </div>

            <DocumentPhoto label="CNH" photo={docs.cnh_foto} />
            <DocumentPhoto label="CRLV (documento do veículo)" photo={docs.crlv_foto} />
            <DocumentPhoto label="Selfie" photo={docs.selfie_foto} />

            <div>
              <DocumentPhoto label="Alvará da prefeitura" photo={docs.alvara_document} />
              {docs.alvara_document && !driver.autorizadoPrefeitura && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="mt-2 flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  <Check size={13} /> {approving ? 'Aprovando…' : 'Aprovar alvará'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// PDF (comum em CRLV/alvará) não dá pra mostrar como <img> — nesse caso
// vira um link "Abrir PDF" que abre o base64 numa aba nova.
function DocumentPhoto({ label, photo }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-ink/55">{label}</p>
      {!photo?.base64 ? (
        <p className="rounded-md border border-dashed border-ink/15 px-3 py-4 text-center text-xs text-ink/40">
          Não enviado
        </p>
      ) : photo.mimetype?.includes('pdf') ? (
        <a
          href={`data:${photo.mimetype};base64,${photo.base64}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-md border border-ink/15 px-3 py-2 text-xs text-brand-700 hover:bg-paper"
        >
          Abrir PDF
        </a>
      ) : (
        <img
          src={`data:${photo.mimetype};base64,${photo.base64}`}
          alt={label}
          className="max-h-64 rounded-md border border-ink/10 object-contain"
        />
      )}
    </div>
  );
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Saldo + histórico de movimentações (wallet_transactions) de UM motoboy,
// com o ajuste manual de saldo embutido embaixo — mesmo padrão do
// DocumentsModal, que mostra dados e embute uma ação (aprovar alvará)
// na mesma tela em vez de abrir mais um modal.
function WalletModal({ driver, onClose, onSaved }) {
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await driversApi.walletHistory(driver.id);
      setHistory(data);
    } finally {
      setLoadingHistory(false);
    }
  }, [driver.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // O saldo mais atual é o balance_after da transação mais recente (o
  // histórico vem em ordem DESC) — só cai pro wallet_balance do prop
  // (snapshot da listagem) enquanto o histórico ainda não carregou.
  const currentBalance = history && history.length > 0 ? history[0].balance_after : driver.wallet_balance;

  async function handleAdjust() {
    if (!amount || !reason) return;
    setError(null);
    setSaving(true);
    try {
      await driversApi.adjustWallet(driver.id, parseFloat(amount), reason);
      setAmount('');
      setReason('');
      await loadHistory();
      onSaved();
    } catch (err) {
      const message = err.response?.data?.error || 'Não consegui ajustar o saldo.';
      setError(message.replace('SALDO_INSUFICIENTE:', ''));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 px-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-md">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink">Carteira — {driver.name}</h3>
          <button onClick={onClose} className="text-ink/45 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm text-ink/55">Saldo atual</p>
          <p className="font-display text-2xl text-ink">R$ {parseFloat(currentBalance).toFixed(2)}</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink/75">Histórico de movimentações</p>
          {loadingHistory ? (
            <p className="text-sm text-ink/55">Carregando…</p>
          ) : history.length === 0 ? (
            <p className="rounded-md border border-dashed border-ink/15 px-3 py-4 text-center text-xs text-ink/40">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {history.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-ink/10 px-3 py-2 text-sm">
                  <div>
                    <p className="text-ink">{t.reason}</p>
                    <p className="text-xs text-ink/45">{formatDateTime(t.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${t.type === 'credit' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {t.type === 'credit' ? '+' : '-'} R$ {parseFloat(t.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-ink/45">Saldo: R$ {parseFloat(t.balance_after).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="mb-2 text-sm font-medium text-ink/75">Ajustar saldo manualmente</p>

          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Valor (negativo p/ debitar)"
              className="w-full rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500 sm:w-44"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (ex: recarga via Pix)"
              className="w-full flex-1 rounded-md border border-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-ember-500"
            />
            <button
              onClick={handleAdjust}
              disabled={saving || !amount || !reason}
              className="rounded-md bg-brand-700 px-4 py-2.5 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
