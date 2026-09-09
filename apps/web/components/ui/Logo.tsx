import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
}

const sizes = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

export function Logo({ className, size = 'md', withText = true }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative grid place-items-center rounded-xl bg-gradient-to-br from-kairos-400 to-kairos-600 text-ink-950 font-black shadow-glow-sm ring-1 ring-kairos-300/40',
          sizes[size],
        )}
      >
        <span className="relative z-10">K</span>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
      </div>
      {withText && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-bold tracking-tight text-ink-50">
            Kairos CRM
          </span>
          {size === 'lg' && (
            <span className="mt-0.5 text-2xs font-medium uppercase tracking-wider text-ink-500">
              Multi-tenant · IA · WhatsApp
            </span>
          )}
        </div>
      )}
    </div>
  );
}
