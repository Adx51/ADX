import type { Alert } from '@/lib/api';
import { AlertTriangle, Clock, TrendingUp, Hourglass } from 'lucide-react';

const META: Record<
  Alert['type'],
  { icon: typeof Clock; color: string; bg: string }
> = {
  PEAK: { icon: TrendingUp, color: 'text-gold-400', bg: 'bg-gold-500/10' },
  DRINK_SOON: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  PAST_PEAK: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  HOLD: { icon: Hourglass, color: 'text-sky-400', bg: 'bg-sky-500/10' },
};

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-neutral-500">Aucune alerte pour le moment.</p>;
  }

  return (
    <ul className="space-y-3">
      {alerts.slice(0, 6).map((a) => {
        const { icon: Icon, color, bg } = META[a.type];
        return (
          <li key={a.bottleId} className="flex gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}
            >
              <Icon size={16} className={color} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-200">
                {a.label}
              </p>
              <p className="text-xs text-neutral-500">{a.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
