/**
 * Painel Operacional do Super Admin (LGPD-compliant)
 *
 * Mostra apenas métricas agregadas dos tenants (contadores, sem dados pessoais).
 * Ações como desabilitar, mudar plano, resetar senha — todas logadas.
 * Para acessar dados pessoais: abrir AccessTicket.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Shield, Building2, Users, MessageSquare, BarChart3, AlertTriangle, FileText, Lock, CreditCard } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, ApiClientError } from '@/lib/api';

interface TenantOverview {
  id: string;
  name: string;
  slug: string;
  email: string;
  plan: string;
  status: string;
  primaryColor: string | null;
  logoUrl: string | null;
  createdAt: string;
  trialEndsAt: string | null;
  metrics: {
    users: number;
    leads: number;
    contacts: number;
    whatsappAccounts: number;
    conversations: number;
    automations: number;
  };
  activeAccessTicket: {
    id: string;
    scope: string;
    reason: string;
    authorizedBy: string | null;
    expiresAt: string;
  } | null;
}

async function fetchOverview(token: string) {
  return apiFetch<{ tenants: TenantOverview[]; complianceNote: string }>(
    '/api/superadmin/tenants/overview',
    { accessToken: token },
  );
}

export default async function SuperAdminPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');

  let data: Awaited<ReturnType<typeof fetchOverview>> | null = null;
  let me: any = null;
  try {
    const meRes = await apiFetch<any>('/api/auth/me', { accessToken: token });
    me = meRes;
    if (me.role !== 'SUPER_ADMIN') {
      redirect('/dashboard');
    }
    data = await fetchOverview(token);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) redirect('/login');
    if (err instanceof ApiClientError && err.status === 403) redirect('/dashboard');
    return (
      <div className="card p-8">
        <h1 className="text-lg font-semibold text-red-400">Erro ao carregar painel</h1>
        <p className="mt-2 text-sm text-ink-400">{(err as Error).message}</p>
      </div>
    );
  }

  if (!data) return null;

  const { tenants, complianceNote } = data;

  const totalUsers = tenants.reduce((acc, t) => acc + t.metrics.users, 0);
  const totalLeads = tenants.reduce((acc, t) => acc + t.metrics.leads, 0);
  const totalConversations = tenants.reduce((acc, t) => acc + t.metrics.conversations, 0);
  const totalWhatsApp = tenants.reduce((acc, t) => acc + t.metrics.whatsappAccounts, 0);
  const activeAccessTickets = tenants.filter((t) => t.activeAccessTicket).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-ink-50">Painel Operacional</h1>
        </div>
        <p className="mt-1 text-sm text-ink-400">
          {complianceNote}
        </p>
      </div>

      {/* LGPD Alert */}
      <div className="card border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-300">Conformidade LGPD</h3>
            <p className="mt-1 text-sm text-ink-300">
              Este painel mostra apenas <strong>contadores agregados</strong>. Você NÃO tem acesso a leads,
              contatos, conversas, mensagens ou knowledge dos tenants. Para visualizar dados pessoais
              (ex: suporte técnico), abra um <strong>AccessTicket</strong> com motivo e autorizador.
              Toda ação sua é registrada em log e retida por 5 anos.
            </p>
          </div>
        </div>
      </div>

      {/* Stats globais */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard icon={Building2} label="Tenants" value={tenants.length} accent="kairos" />
        <StatCard icon={Users} label="Usuários" value={totalUsers} accent="ink" />
        <StatCard icon={BarChart3} label="Leads" value={totalLeads} accent="blue" />
        <StatCard icon={MessageSquare} label="Conversas" value={totalConversations} accent="ink" />
        <StatCard icon={MessageSquare} label="WhatsApps" value={totalWhatsApp} accent="kairos" />
      </div>

      {activeAccessTickets > 0 && (
        <div className="card border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {activeAccessTickets} AccessTicket(s) ativo(s) — dados sensíveis sendo acessados
            </span>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2">
        <Link href="/super-admin/access-tickets" className="btn-ghost text-sm">
          <FileText className="h-4 w-4" /> Access Tickets ({activeAccessTickets})
        </Link>
        <Link href="/super-admin/billing" className="btn-ghost text-sm">
          <CreditCard className="h-4 w-4" /> Cobrança
        </Link>
        <Link href="/super-admin/audit" className="btn-ghost text-sm">
          <FileText className="h-4 w-4" /> Audit Log
        </Link>
      </div>

      {/* Tabela de tenants */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-700/50 bg-ink-900/40">
              <tr className="text-left text-2xs uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Contatos</th>
                <th className="px-4 py-3 text-right">WhatsApp</th>
                <th className="px-4 py-3 text-right">Conversas</th>
                <th className="px-4 py-3 text-right">Auto.</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/30">
              {tenants.map((t) => {
                const isActive = t.status === 'ACTIVE' || t.status === 'TRIAL';
                return (
                  <tr key={t.id} className="hover:bg-ink-900/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.logoUrl ? (
                          <img src={t.logoUrl} alt="" className="h-6 w-6 rounded" />
                        ) : (
                          <div
                            className="grid h-6 w-6 place-items-center rounded text-2xs font-bold text-white"
                            style={{ backgroundColor: t.primaryColor || '#10b981' }}
                          >
                            {t.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-ink-100">{t.name}</p>
                          <p className="text-2xs text-ink-500">{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-2xs font-medium ${
                        t.plan === 'PREMIUM' ? 'bg-purple-500/10 text-purple-400' :
                        t.plan === 'PRO' ? 'bg-blue-500/10 text-blue-400' :
                        t.plan === 'BASIC' ? 'bg-kairos-500/10 text-kairos-400' :
                        'bg-ink-500/10 text-ink-400'
                      }`}>{t.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-2xs font-medium ${
                        t.status === 'ACTIVE' ? 'bg-kairos-500/10 text-kairos-400' :
                        t.status === 'TRIAL' ? 'bg-blue-500/10 text-blue-400' :
                        t.status === 'SUSPENDED' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>{t.status}</span>
                      {t.activeAccessTicket && (
                        <div className="mt-1 text-2xs text-amber-400">
                          🔓 ticket aberto
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink-200">{t.metrics.users}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-200">{t.metrics.leads}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-200">{t.metrics.contacts}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-200">{t.metrics.whatsappAccounts}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-200">{t.metrics.conversations}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-200">{t.metrics.automations}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/super-admin/tenants/${t.id}`}
                        className="text-2xs font-medium text-kairos-400 hover:text-kairos-300"
                      >
                        gerenciar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  const accentClass: Record<string, string> = {
    kairos: 'text-kairos-400 bg-kairos-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    ink: 'text-ink-300 bg-ink-700/30',
  };
  const cls = accentClass[accent] || 'text-ink-300 bg-ink-700/30';
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${cls}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wider text-ink-500">{label}</p>
          <p className="text-2xl font-bold text-ink-50">{value}</p>
        </div>
      </div>
    </div>
  );
}
