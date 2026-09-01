import React from 'react';

export default function StatCard({ label, value, hint }) {
  return (
    <div className="bg-white border border-ink/10 rounded-sm p-5">
      <p className="text-xs text-ink/55 mb-2">{label}</p>
      <p className="text-2xl font-display">{value}</p>
      {hint && <p className="text-xs text-ink/45 mt-1">{hint}</p>}
    </div>
  );
}
