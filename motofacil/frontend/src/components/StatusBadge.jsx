import React from 'react';

const STYLES = {
  pending_payment: 'bg-amber-100 text-amber-800',
  searching_driver: 'bg-blue-100 text-blue-800',
  accepted: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-brand-100 text-brand-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  available: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-blue-100 text-blue-800',
  offline: 'bg-gray-200 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
};

const LABELS = {
  pending_payment: 'Aguardando pagamento',
  searching_driver: 'Buscando motoboy',
  accepted: 'Aceita',
  in_transit: 'Em rota',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  available: 'Disponível',
  busy: 'Em corrida',
  offline: 'Offline',
  pending_approval: 'Aguardando aprovação',
  blocked: 'Bloqueado',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {LABELS[status] || status}
    </span>
  );
}
