import {
  Users,
  MessageSquare,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Clock,
  Rocket,
  ArrowUpRight,
  Circle,
} from 'lucide-react';
import { getAccessToken, meRequest } from '@/lib/auth';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { initials } from '@/lib/utils';
import Link from 'next/link';

export default async function DashboardPage() {
  const token = getAccessToken()!;
  const me = await meRequest(token);

  const checklist = [
    { ok: true, label: 'Multi-tenant isolado (Tenant A ≠ Tenant B)' },
    { ok: true, label: 'Auth JWT com access + refresh rotativo' },
    { ok: true, label: '5 roles: SUPER_ADMIN, TENANT_ADMIN, MANAGER, AGENT, USER' },
    { ok: true, label: 'Endpoints: /api/auth, /api/tenants, /api/users' },
    { ok: true, label: 'Super Admin: criar, listar, suspender, ativar tenants' },
    { ok: true, label: 'Audit log de ações sensíveis' },
    { ok: true, label: 'Postgres isolado: kairos_crm_db' },
    { ok: true, label: 'Deploy em produção' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-50">
            Olá, {me.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {me.tenantName
              ? <>Você está no tenant <span className="font-medium text-kairos-400">{me.tenantName}</span>.</>
              : <>Você está no painel <span className="font-medium text-kairos-400">Super Admin</span>.</>
            }
          </p>
        </div>
        <Link href="/register" className="btn-secondary">
          Convidar usuário <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Leads" value="—" hint="Disponível na Fase 2" />
        <Stat icon={MessageSquare} label="Conversas" value="—" hint="Disponível na Fase 3" />
        <Stat icon={TrendingUp} label="Vendas" value="—" hint="Disponível na Fase 2" />
        <Stat icon={Sparkles} label="IA (Hermes)" value="—" hint="Disponível na Fase 4" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Fase 1 — Concluída */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-kairos-400" />
                <h2 className="text-lg font-semibold text-ink-50">Fase 1 — Fundação</h2>
              </div>
              <p className="mt-1 text-sm text-ink-400">
                Monorepo, multi-tenant, auth, RBAC, Super Admin, audit log, deploy.
              </p>
            </div>
            <Badge variant="kairos">Concluída</Badge>
          </div>

          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm text-ink-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-kairos-400" />
                {c.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Próximas fases */}
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-ink-50">Próximas fases</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { n: 2, name: 'CRM Core', desc: 'Contatos, Leads, Funis Kanban, Tarefas', color: 'kairos' as const },
                { n: 3, name: 'WhatsApp', desc: 'Provider abstraction, Inbox, Webhook', color: 'amber' as const },
                { n: 4, name: 'Hermes IA', desc: 'LLM abstraction, Tools, RAG', color: 'amber' as const },
                { n: 5, name: 'Automações', desc: 'Follow-ups, agenda, workflows visuais', color: 'ink' as const },
              ].map((f) => (
                <div key={f.n} className="flex items-center justify-between rounded-lg bg-ink-900/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 font-mono text-xs font-bold text-ink-300">
                      {f.n.toString().padStart(2, '0')}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink-100">{f.name}</div>
                      <div className="text-xs text-ink-500">{f.desc}</div>
                    </div>
                  </div>
                  <Circle className="h-3 w-3 text-ink-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-900/40 px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 truncate font-mono text-xs text-ink-300">{value}</div>
    </div>
  );
}
