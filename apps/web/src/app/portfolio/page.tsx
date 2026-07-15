import { api, type Overview, type Bottle } from '@/lib/api';
import { withFallback, demoOverview, demoBottles } from '@/lib/demo';
import { StatCard, Card, eur } from '@/components/ui';

export default async function PortfolioPage() {
  const [overview, bottles] = await Promise.all([
    withFallback<Overview>(() => api.get('/stats/overview'), demoOverview),
    withFallback<Bottle[]>(() => api.get('/bottles'), demoBottles),
  ]);

  const ranked = [...bottles]
    .map((b) => {
      const cost = Number(b.purchasePrice ?? 0);
      const val = Number(b.estimatedValue ?? 0);
      return { b, cost, val, delta: val - cost, pct: cost ? ((val - cost) / cost) * 100 : 0 };
    })
    .sort((a, z) => z.delta - a.delta);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold text-white">
          Patrimoine vinicole
        </h1>
        <p className="text-sm text-neutral-500">
          Suivez votre cave comme un portefeuille d’investissement
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Valeur estimée" value={eur(overview.totalValue)} accent="gold" />
        <StatCard label="Coût d’acquisition" value={eur(overview.totalCost)} />
        <StatCard
          label="Plus-value latente"
          value={eur(overview.gain)}
          accent={overview.gain >= 0 ? 'gain' : 'loss'}
        />
        <StatCard
          label="Rendement global"
          value={`${overview.returnPct > 0 ? '+' : ''}${overview.returnPct}%`}
          accent={overview.returnPct >= 0 ? 'gain' : 'loss'}
        />
      </section>

      <Card>
        <h2 className="mb-4 font-display text-lg font-medium text-white">
          Meilleures performances
        </h2>
        <ul className="space-y-3">
          {ranked.map(({ b, val, delta, pct }) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-4 border-b border-white/[0.03] pb-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-100">
                  {b.wine.domain} {b.wine.vintage ?? ''}
                </p>
                <p className="text-xs text-neutral-500">{b.wine.region}</p>
              </div>
              <div className="flex items-center gap-6 text-right">
                <span className="text-sm text-neutral-300">{eur(val)}</span>
                <span
                  className={`w-24 text-sm font-medium ${
                    delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {delta >= 0 ? '+' : ''}
                  {eur(delta)}{' '}
                  <span className="text-xs opacity-70">
                    ({pct >= 0 ? '+' : ''}
                    {Math.round(pct)}%)
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
