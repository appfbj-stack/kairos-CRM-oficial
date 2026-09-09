import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { getAccessToken, meRequest, ApiClientError } from '@/lib/auth';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/AnimatedNumber';
import { initials } from '@/lib/utils';
import { SidebarNav, type NavItem } from '@/components/ui/SidebarNav';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconKey: 'dashboard' },
  { href: '/contacts', label: 'Contatos', iconKey: 'contacts' },
  { href: '/leads', label: 'Leads', iconKey: 'leads' },
  { href: '/tasks', label: 'Tarefas', iconKey: 'tasks' },
  { href: '/products', label: 'Produtos', iconKey: 'products' },
  { href: '/services', label: 'Serviços', iconKey: 'services' },
  { href: '/inbox', label: 'Conversas', iconKey: 'conversations' },
  { href: '/knowledge', label: 'Conhecimento', iconKey: 'knowledge' },
  { href: '/hermes', label: 'Kairos IA', iconKey: 'hermes' },
  { href: '/pipelines', label: 'Funis', iconKey: 'pipelines', soon: true },
  { href: '/automations', label: 'Automações', iconKey: 'automations' },
  { href: '/settings', label: 'Configurações', iconKey: 'settings' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = getAccessToken();
  if (!token) redirect('/login');

  let me;
  try {
    me = await meRequest(token);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  return (
    <div className="flex min-h-screen bg-ink-950">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-800/60 bg-ink-950/40 backdrop-blur md:flex">
        <div className="flex h-16 items-center border-b border-ink-800/60 px-5">
          <Logo size="sm" />
        </div>

        <div className="px-3 py-4">
          <div className="mb-2 px-2 text-2xs font-semibold uppercase tracking-wider text-ink-600">
            Navegação
          </div>
          <nav className="space-y-0.5">
            <SidebarNav items={navItems} />
          </nav>
        </div>

        <div className="mt-auto border-t border-ink-800/60 p-3">
          <div className="card flex items-center gap-3 p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-kairos-400 to-kairos-600 text-xs font-bold text-ink-950">
              {initials(me.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink-100">{me.name}</div>
              <div className="truncate text-xs text-ink-500">{me.email}</div>
              <Badge variant="kairos" className="mt-1.5">
                {me.role.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button type="submit" className="btn-ghost w-full justify-start text-sm">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink-800/60 bg-ink-950/70 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-ink-300">
              {me.tenantName || 'Painel Super Admin'}
            </h1>
            <span className="text-ink-700">/</span>
            <span className="text-sm font-semibold text-ink-100">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="amber" pulse>Fase 1 — Fundação</Badge>
          </div>
        </div>
        <div className="px-6 py-6 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
