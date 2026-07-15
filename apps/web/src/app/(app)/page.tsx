import type { Overview, Distribution, Alert } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { withFallback, demoOverview, demoDistribution, demoAlerts } from '@/lib/demo';
import { StatCard, Card, eur } from '@/components/ui';
import { DistributionChart } from '@/components/distribution-chart';
import { AlertList } from '@/components/alert-list';

export default async function DashboardPage() {
  const api = serverApi();
  const [overview, distribution, alerts] = await Promise.all([
    withFallback<Overview>(() => api.get('/stats/overview'), demoOverview),
    withFallback<Distribution>(() => api.get('/stats/distribution'), demoDistribution),
    withFallback<Alert[]>(() => api.get('/stats/alerts'), demoAlerts),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm text-neutral-500">Bonsoir, Antoine</p>
        <h1 className="font-display text-3xl font-semibold text-white">
          Votre patrimoine vinicole
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Valeur totale"
          value={eur(overview.totalValue)}
          sub={`${overview.bottleCount} bouteilles`}
          accent="gold"
        />
        <StatCard
          label="Plus-value"
          value={eur(overview.gain)}
          sub={`Investi ${eur(overview.totalCost)}`}
          accent={overview.gain >= 0 ? 'gain' : 'loss'}
        />
        <StatCard
          label="Rendement"
          value={`${overview.returnPct > 0 ? '+' : ''}${overview.returnPct}%`}
          sub="depuis l’achat"
          accent={overview.returnPct >= 0 ? 'gain' : 'loss'}
        />
        <StatCard
          label="Valeur moyenne"
          value={eur(overview.avgBottleValue)}
          sub={`${overview.uniqueWines} vins uniques`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-medium text-white">
            Répartition de la cave
          </h2>
          <DistributionChart distribution={distribution} />
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-lg font-medium text-white">
            Alertes de garde
          </h2>
          <AlertList alerts={alerts} />
        </Card>
      </section>
    </div>
  );
}
