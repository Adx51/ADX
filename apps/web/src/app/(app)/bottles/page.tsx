import type { Bottle } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { withFallback, demoBottles } from '@/lib/demo';
import { Card, ColorBadge, eur } from '@/components/ui';
import { Wine } from 'lucide-react';

export default async function BottlesPage() {
  const bottles = await withFallback<Bottle[]>(
    () => serverApi().get('/bottles'),
    demoBottles,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white">
            Mes bouteilles
          </h1>
          <p className="text-sm text-neutral-500">
            {bottles.reduce((n, b) => n + b.quantity, 0)} bouteilles en cave
          </p>
        </div>
        <button className="rounded-xl bg-bordeaux-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-bordeaux-500">
          + Ajouter
        </button>
      </header>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-widest text-neutral-500">
              <th className="px-5 py-3 font-medium">Vin</th>
              <th className="px-5 py-3 font-medium">Région</th>
              <th className="px-5 py-3 font-medium">Qté</th>
              <th className="px-5 py-3 text-right font-medium">Achat</th>
              <th className="px-5 py-3 text-right font-medium">Estimation</th>
              <th className="px-5 py-3 text-right font-medium">+/–</th>
            </tr>
          </thead>
          <tbody>
            {bottles.map((b) => {
              const cost = Number(b.purchasePrice ?? 0);
              const val = Number(b.estimatedValue ?? 0);
              const delta = val - cost;
              return (
                <tr
                  key={b.id}
                  className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                        <Wine size={16} className="text-bordeaux-400" />
                      </span>
                      <div>
                        <p className="font-medium text-neutral-100">
                          {b.wine.domain}
                          {b.wine.vintage ? ` ${b.wine.vintage}` : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500">
                            {b.wine.cuvee || b.wine.appellation}
                          </span>
                          <ColorBadge color={b.wine.color} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-neutral-400">{b.wine.region}</td>
                  <td className="px-5 py-4 text-neutral-300">{b.quantity}</td>
                  <td className="px-5 py-4 text-right text-neutral-400">
                    {cost ? eur(cost) : '—'}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-white">
                    {val ? eur(val) : '—'}
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-medium ${
                      delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {cost ? `${delta >= 0 ? '+' : ''}${eur(delta)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
