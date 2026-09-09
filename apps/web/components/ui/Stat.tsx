import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: { value: number; positive?: boolean };
  hint?: string;
  className?: string;
}

export function Stat({ icon: Icon, label, value, delta, hint, className }: StatProps) {
  return (
    <div className={cn('card p-5 transition-all duration-300 hover:ring-ink-700', className)}>
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-kairos-500/10 text-kairos-400 ring-1 ring-kairos-500/20">
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
              delta.positive
                ? 'bg-kairos-500/10 text-kairos-300 ring-kairos-500/20'
                : 'bg-red-500/10 text-red-300 ring-red-500/20',
            )}
          >
            {delta.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta.value > 0 ? '+' : ''}
            {delta.value}%
          </div>
        )}
      </div>
      <div className="mt-4 text-3xl font-bold tracking-tight text-ink-50">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{label}</div>
      {hint && <div className="mt-2 text-2xs text-ink-600">{hint}</div>}
    </div>
  );
}
