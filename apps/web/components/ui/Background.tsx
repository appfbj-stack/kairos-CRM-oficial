import { cn } from '@/lib/utils';

/**
 * Background decorativo padrão do Kairos CRM.
 * Grid sutil + radial fade + noise. Fixed no body.
 */
export function Background({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-ink-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.18),transparent_70%)]" />
      <div className="absolute inset-0 bg-grid-pattern bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_30%,transparent_100%)]" />
      <div className="absolute inset-0 surface-noise opacity-50" />
      <div className="absolute -top-1/3 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-kairos-500/10 blur-3xl" />
    </div>
  );
}
