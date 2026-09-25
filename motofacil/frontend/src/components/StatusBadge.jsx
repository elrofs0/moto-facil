import React from 'react';

const STYLES = {
  pending_payment: 'bg-ember-50 text-ember-700',
  searching_driver: 'bg-blue-50 text-blue-700',
  accepted: 'bg-indigo-50 text-indigo-700',
  in_transit: 'bg-brand-100 text-brand-800',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  available: 'bg-emerald-50 text-emerald-700',
  busy: 'bg-blue-50 text-blue-700',
  offline: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-ember-50 text-ember-700',
  blocked: 'bg-red-50 text-red-700',
};

const DOTS = {
  pending_payment: 'bg-ember-500',
  searching_driver: 'bg-blue-500',
  accepted: 'bg-indigo-500',
  in_transit: 'bg-brand-600',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  available: 'bg-emerald-500',
  busy: 'bg-blue-500',
  offline: 'bg-gray-400',
  pending_approval: 'bg-ember-500',
  blocked: 'bg-red-500',
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        STYLES[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[status] || 'bg-gray-400'}`} />
      {LABELS[status] || status}
    </span>
  );
}
