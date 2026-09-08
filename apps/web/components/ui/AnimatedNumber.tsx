import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'kairos' | 'amber' | 'ink';
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const variants = {
  kairos: 'bg-kairos-500/10 text-kairos-300 ring-kairos-500/30',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  ink: 'bg-ink-800/80 text-ink-300 ring-ink-700',
};

export function Badge({ variant = 'kairos', children, className, pulse }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
        variants[variant],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
