import {
  Users,
  MessageSquare,
  TrendingUp,
  Sparkles,
  Building2,
  CheckCircle2,
  UserCheck,
  ListChecks,
  CircleAlert,
  PhoneCall,
  CalendarClock,
  Target,
  ArrowUpRight,
} from 'lucide-react';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/AnimatedNumber';
import { initials } from '@/lib/utils';
import Link from 'next/link';

const money = (cents: number | null | undefined) => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const dateShort = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const dateTime = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  BLOCKED: 'Bloqueado',
  TRIAL: 'Trial',
  FREE: 'Free',
  BASIC: 'Básico',
  PRO: 'Pro',
  PREMIUM: 'Premium',
  OPEN: 'Aberto',
  WON: 'Ganho',
  LOST: 'Perdido',
  COLD: 'Frio',
  WARM: 'Morno',
  HOT: 'Quente',
};

export default async function DashboardPage() {
  const token = getAccessToken()!;
  const me = await meRequest(token);
  const stats: any = await apiFetch('/api/dashboard/stats', { accessToken: token });

  const isSuper = stats?.scope === 'super';

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-50">
            Olá, {me.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {me.tenantName ? (
              <>
                Você está no tenant{' '}
                <span className="font-medium text-kairos-400">{me.tenantName}</span>.
              </>
            ) : (
              <>
                Você está no painel{' '}
                <span className="font-medium text-kairos-400">Super Admin</span>.
              </>
            )}
          </p>
        </div>
        <Link href="/register" className="btn-secondary">
          Convidar usuário <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isSuper ? <SuperAdminView stats={stats} /> : <TenantView stats={stats} />}

      {/* Account info */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-kairos-400 to-kairos-600 text-base font-bold text-ink-950">
            {initials(me.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-ink-100">{me.name}</h3>
              <Badge variant="kairos">{me.role.replace('_', ' ')}</Badge>
            </div>
            <p className="text-sm text-ink-400">{me.email}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Info label="ID" value={me.id.slice(0, 8) + '…'} />
              <Info label="Tenant ID" value={me.tenantId ? me.tenantId.slice(0, 8) + '…' : '—'} />
              <Info label="Slug" value={me.tenantSlug || '—'} />
              <Info label="Tenant" value={me.tenantName || '—'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuperAdminView({ stats }: { stats: any }) {
  const t = stats.totals;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Building2}
          label="Tenants"
          value={t.tenants}
          hint={`${t.activeTenants} ativos`}
        />
        <Stat
          icon={Users}
          label="Usuários"
          value={t.users}
          hint="Em todos os tenants"
        />
        <Stat
          icon={Target}
          label="Leads"
          value={t.leads}
          delta={
            t.conversionRate
              ? { value: t.conversionRate, positive: true }
              : undefined
          }
          hint={`${t.wonLeads} ganhos · ${t.conversionRate}% conversão`}
        />
        <Stat
          icon={MessageSquare}
          label="Mensagens hoje"
          value={t.messagesToday}
          hint={`${t.conversations} conversas totais`}
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-50">Tenants recentes</h2>
            <p className="mt-1 text-sm text-ink-400">Últimos 5 tenants criados</p>
          </div>
          <Link href="/tenants" className="text-sm text-kairos-400 hover:text-kairos-300">
            Ver todos →
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-ink-800">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/60 text-2xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nome</th>
                <th className="px-4 py-2 text-left font-medium">Slug</th>
                <th className="px-4 py-2 text-left font-medium">Plano</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 bg-ink-950/40">
              {stats.recentTenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                    Nenhum tenant ainda.
                  </td>
                </tr>
              )}
              {stats.recentTenants.map((tn: any) => (
                <tr key={tn.id} className="hover:bg-ink-900/40">
                  <td className="px-4 py-2.5 text-ink-100">{tn.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-400">{tn.slug}</td>
                  <td className="px-4 py-2.5 text-ink-300">{statusLabels[tn.plan] || tn.plan}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={tn.status === 'ACTIVE' ? 'kairos' : 'amber'}>
                      {statusLabels[tn.status] || tn.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-400">
                    {dateShort(tn.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function TenantView({ stats }: { stats: any }) {
  const t = stats.totals;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={UserCheck}
          label="Leads abertos"
          value={t.openLeads}
          hint={`${t.leads} no total`}
        />
        <Stat
          icon={MessageSquare}
          label="Conversas abertas"
          value={t.openConversations}
          hint={`${t.conversations} no total`}
        />
        <Stat
          icon={MessageSquare}
          label="Mensagens hoje"
          value={t.messagesToday}
          hint="Inbound + outbound"
        />
        <Stat
          icon={ListChecks}
          label="Tarefas abertas"
          value={t.openTasks}
          hint={
            t.overdueTasks > 0
              ? `${t.overdueTasks} atrasadas`
              : 'Em dia'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Funil / conversão */}
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-kairos-400" />
            <h2 className="text-lg font-semibold text-ink-50">Funil</h2>
          </div>
          <p className="mt-1 text-sm text-ink-400">Status dos leads</p>

          <div className="mt-5 space-y-3">
            <FunnelRow label="Abertos" value={t.openLeads} total={t.leads} color="kairos" />
            <FunnelRow label="Ganhos" value={t.wonLeads} total={t.leads} color="emerald" />
            <FunnelRow label="Perdidos" value={t.lostLeads} total={t.leads} color="red" />
          </div>

          <div className="mt-5 rounded-lg bg-ink-900/40 p-3">
            <div className="text-2xs uppercase tracking-wider text-ink-500">Taxa de conversão</div>
            <div className="mt-1 text-2xl font-bold text-ink-50">{t.conversionRate}%</div>
          </div>
        </div>

        {/* Leads recentes */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink-50">Leads recentes</h2>
              <p className="mt-1 text-sm text-ink-400">Últimos 5 criados</p>
            </div>
            <Link href="/leads" className="text-sm text-kairos-400 hover:text-kairos-300">
              Ver Kanban →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {stats.recentLeads.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink-800 p-6 text-center text-sm text-ink-500">
                Nenhum lead ainda. Crie o primeiro em{' '}
                <Link href="/leads" className="text-kairos-400">
                  Leads
                </Link>
                .
              </div>
            )}
            {stats.recentLeads.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg bg-ink-900/40 p-3 hover:bg-ink-900/70"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-xs font-bold text-ink-300">
                    {(l.contact?.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink-100">{l.title}</div>
                    <div className="text-xs text-ink-500">
                      {l.contact?.name || '—'} · {dateShort(l.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {l.valueCents ? (
                    <span className="font-mono text-xs text-ink-300">{money(l.valueCents)}</span>
                  ) : null}
                  <Badge
                    variant={
                      l.temperature === 'HOT'
                        ? 'amber'
                        : l.status === 'WON'
                          ? 'kairos'
                          : 'ink'
                    }
                  >
                    {statusLabels[l.status] || l.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Próximos agendamentos */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-kairos-400" />
              <h2 className="text-lg font-semibold text-ink-50">Próximos agendamentos</h2>
            </div>
            <Link href="/automations" className="text-sm text-kairos-400 hover:text-kairos-300">
              Ver agenda →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {stats.upcomingAppointments.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink-800 p-6 text-center text-sm text-ink-500">
                Nenhum agendamento próximo.
              </div>
            )}
            {stats.upcomingAppointments.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-ink-900/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-kairos-500/10 text-kairos-400">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink-100">
                      {a.contact?.name || 'Contato'}
                    </div>
                    <div className="text-xs text-ink-500">{dateTime(a.startTime)}</div>
                  </div>
                </div>
                <Badge variant="kairos">{a.status}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Atalhos rápidos */}
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-kairos-400" />
            <h2 className="text-lg font-semibold text-ink-50">Atalhos rápidos</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Shortcut href="/contacts" label="Novo contato" />
            <Shortcut href="/leads" label="Novo lead" />
            <Shortcut href="/tasks" label="Nova tarefa" />
            <Shortcut href="/inbox" label="Abrir inbox" />
            <Shortcut href="/hermes" label="Kairos IA" />
            <Shortcut href="/automations" label="Automações" />
          </div>
        </div>
      </div>
    </>
  );
}

function FunnelRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: 'kairos' | 'emerald' | 'red';
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorMap = {
    kairos: 'bg-kairos-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-300">{label}</span>
        <span className="font-mono text-ink-400">
          {value} <span className="text-ink-600">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full ${colorMap[color]} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg bg-ink-900/40 px-3 py-2.5 text-sm text-ink-200 transition hover:bg-ink-800/60 hover:text-ink-50"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 text-ink-500" />
    </Link>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-900/40 px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 truncate font-mono text-xs text-ink-300">{value}</div>
    </div>
  );
}
