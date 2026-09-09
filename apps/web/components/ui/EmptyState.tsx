import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('card p-10 text-center', className)}>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kairos-500/10 text-kairos-400 ring-1 ring-kairos-500/20">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-100">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
