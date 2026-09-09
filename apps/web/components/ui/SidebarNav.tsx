'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutDashboard, Users, MessageSquare, KanbanSquare, Settings, Sparkles, Contact, CheckSquare, Package, Briefcase, BookOpen, Zap, Smartphone, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  iconKey: 'dashboard' | 'contacts' | 'leads' | 'tasks' | 'products' | 'services' | 'conversations' | 'pipelines' | 'hermes' | 'settings' | 'knowledge' | 'automations' | 'whatsapp' | 'shield';
  soon?: boolean;
  superAdminOnly?: boolean;
}

const ICONS: Record<NavItem['iconKey'], any> = {
  dashboard: LayoutDashboard,
  contacts: Contact,
  leads: Users,
  tasks: CheckSquare,
  products: Package,
  services: Briefcase,
  conversations: MessageSquare,
  pipelines: KanbanSquare,
  hermes: Sparkles,
  settings: Settings,
  knowledge: BookOpen,
  automations: Zap,
  whatsapp: Smartphone,
  shield: Shield,
};

export function SidebarNav({ items, role }: { items: NavItem[]; role?: string }) {
  const pathname = usePathname();
  const visible = items.filter((i) => !i.superAdminOnly || role === 'SUPER_ADMIN');
  return (
    <nav className="space-y-0.5">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = ICONS[item.iconKey] || LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition',
              active
                ? item.superAdminOnly
                  ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20'
                  : 'bg-kairos-500/10 text-kairos-300 ring-1 ring-kairos-500/20'
                : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100',
            )}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            {item.soon ? (
              <span className="text-2xs text-ink-600 group-hover:text-ink-500">em breve</span>
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-ink-600" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
