import { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'default' | 'gain' | 'loss' | 'gold';
}) {
  const accentColor =
    accent === 'gain'
      ? 'text-emerald-400'
      : accent === 'loss'
        ? 'text-rose-400'
        : accent === 'gold'
          ? 'text-gold-400'
          : 'text-white';

  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <span className={`font-display text-3xl font-semibold ${accentColor}`}>
        {value}
      </span>
      {sub && <span className="text-sm text-neutral-400">{sub}</span>}
    </Card>
  );
}

const COLOR_LABELS: Record<string, { label: string; dot: string }> = {
  RED: { label: 'Rouge', dot: 'bg-bordeaux-500' },
  WHITE: { label: 'Blanc', dot: 'bg-amber-200' },
  ROSE: { label: 'Rosé', dot: 'bg-pink-400' },
  ORANGE: { label: 'Orange', dot: 'bg-orange-400' },
  UNKNOWN: { label: 'Inconnu', dot: 'bg-neutral-500' },
};

export function ColorBadge({ color }: { color: string | null }) {
  const c = COLOR_LABELS[color ?? 'UNKNOWN'] ?? COLOR_LABELS.UNKNOWN;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function eur(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v || 0);
}
