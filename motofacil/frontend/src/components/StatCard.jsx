import React from 'react';

// Borda colorida à esquerda no lugar de sombra genérica — diferencia os
// quatro números do faturamento sem recorrer ao kit de cards idênticos.
const ACCENTS = {
  brand: 'border-l-brand-600',
  ember: 'border-l-ember-500',
  ink: 'border-l-ink/30',
};

export default function StatCard({ label, value, hint, accent = 'ink' }) {
  return (
    <div className={`rounded-md border border-ink/10 border-l-4 bg-white p-5 ${ACCENTS[accent]}`}>
      <p className="text-xs text-ink/55">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/45">{hint}</p>}
    </div>
  );
}
