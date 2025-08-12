'use client';

import React from 'react';
import Card from '@/components/ui/Card';
import ClientChart from './price-chart';

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <section className="flex items-center justify-between gap-2">
        <div>
          <div className="text-2xl font-semibold">Pulpit</div>
          <div className="muted text-sm">Podgląd mocy, cen i historii</div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Ceny Day‑Ahead" subtitle="ENTSO‑E → PLN/MWh">
          <ClientChart />
        </Card>
        <Card title="Moc teraz">
          <div className="text-3xl font-semibold">—</div>
          <div className="muted text-sm">Połącz z FoxESS, aby zobaczyć</div>
        </Card>
        <Card title="Zysk dziś">
          <div className="text-3xl font-semibold">—</div>
          <div className="muted text-sm">Brak danych</div>
        </Card>
      </section>
    </div>
  );
}
