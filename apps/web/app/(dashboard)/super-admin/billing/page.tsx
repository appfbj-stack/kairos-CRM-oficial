import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, AlertTriangle, DollarSign, Users, CheckCircle2, XCircle } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, ApiClientError } from '@/lib/api';
import { BillingActions } from './BillingActions';

interface BillingTenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  plan: string;
  status: string;
  paymentDueDate: string | null;
  lastPaymentAt: string | null;
  monthlyAmount: number | null;
  overdueDays: number;
  isOverdue: boolean;
  blocked: boolean;
}

interface BillingSummary {
  totalTenants: number;
  active: number;
  overdue: number;
  blocked: number;
  monthlyRevenue: number;
  overdueAmount: number;
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default async function BillingPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');

  let me: any;
  let data: { tenants: BillingTenant[]; summary: BillingSummary } | null = null;
  try {
    me = await apiFetch<any>('/api/auth/me', { accessToken: token });
    if (me.role !== 'SUPER_ADMIN') redirect('/dashboard');
    data = await apiFetch<{ tenants: BillingTenant[]; summary: BillingSummary }>(
      '/api/superadmin/billing',
      { accessToken: token },
    );
  } catch (err) {
    if (err instanceof ApiClientError) redirect('/login');
    return <div className="card p-8 text-red-400">{(err as Error).message}</div>;
  }

  if (!data) return null;
  const { tenants, summary } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-kairos-400" />
          <h1 className="text-2xl font-bold text-ink-50">Painel de Cobrança</h1>
        </div>
        <p className="mt-1 text-sm text-ink-400">
          Inadimplentes, receita mensal e ações de bloqueio. Tudo logado em audit (5 anos).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard icon={Users} label="Tenants ativos" value={summary.active} accent="kairos" />
        <KpiCard icon={AlertTriangle} label="Inadimplentes" value={summary.overdue} accent="amber" />
        <KpiCard icon={XCircle} label="Bloqueados" value={summary.blocked} accent="red" />
        <KpiCard icon={DollarSign} label="Receita mensal" value={formatBRL(summary.monthlyRevenue)} accent="blue" />
      </div>

      {summary.overdue > 0 && (
        <div className="card border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {summary.overdue} tenant{summary.overdue > 1 ? 's' : ''} inadimplente{summary.overdue > 1 ? 's' : ''} — total em aberto: {formatBRL(summary.overdueAmount)}
            </span>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="border-b border-ink-700/50 bg-ink-900/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-200">Tenants ({tenants.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/40 text-2xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Tenant</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Mensal</th>
                <th className="px-4 py-3 text-left">Vencimento</th>
                <th className="px-4 py-3 text-left">Último pgto</th>
                <th className="px-4 py-3 text-right">Atraso</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/30">
              {tenants.map((t) => (
                <tr key={t.id} className={t.blocked ? 'bg-red-500/5' : t.isOverdue ? 'bg-amber-500/5' : 'hover:bg-ink-900/30'}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-ink-100">{t.name}</p>
                      <p className="text-2xs text-ink-500">{t.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-ink-700/30 px-2 py-0.5 text-2xs font-medium text-ink-300">{t.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.blocked ? (
                      <span className="rounded bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-400">🔒 BLOCKED</span>
                    ) : t.isOverdue ? (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-400">⚠ OVERDUE</span>
                    ) : (
                      <span className="rounded bg-kairos-500/10 px-2 py-0.5 text-2xs font-medium text-kairos-400">● ATIVO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink-200">
                    {t.monthlyAmount ? formatBRL(t.monthlyAmount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-300">
                    {formatDate(t.paymentDueDate)}
                  </td>
                  <td className="px-4 py-3 text-ink-400">
                    {formatDate(t.lastPaymentAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.overdueDays > 0 ? (
                      <span className="font-mono font-bold text-amber-400">{t.overdueDays}d</span>
                    ) : (
                      <span className="text-ink-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BillingActions tenant={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent: string }) {
  const colors: Record<string, string> = {
    kairos: 'bg-kairos-500/10 text-kairos-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
    blue: 'bg-blue-500/10 text-blue-400',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${colors[accent]}`}>
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
