/**
 * Audit log do Super Admin.
 * Mostra todas as ações registradas pelo super admin (5 anos de retenção).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Shield } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, ApiClientError } from '@/lib/api';

interface Action {
  id: string;
  superAdminId: string;
  tenantId: string | null;
  action: string;
  target: string | null;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  superAdmin: { id: string; name: string; email: string };
}

const actionLabels: Record<string, { label: string; color: string }> = {
  TENANT_OVERVIEW_VIEW: { label: 'Listou tenants', color: 'ink' },
  TENANT_DETAIL_VIEW: { label: 'Viu detalhe de tenant', color: 'blue' },
  TENANT_USERS_VIEW: { label: 'Listou usuários', color: 'ink' },
  TENANT_DISABLE: { label: 'Desativou tenant', color: 'amber' },
  TENANT_ENABLE: { label: 'Reativou tenant', color: 'kairos' },
  TENANT_CHANGE_PLAN: { label: 'Mudou plano', color: 'blue' },
  PASSWORD_RESET: { label: 'Resetou senha', color: 'amber' },
  ACCESS_TICKET_OPEN: { label: 'Abriu Access Ticket', color: 'amber' },
  ACCESS_TICKET_CLOSE: { label: 'Fechou Access Ticket', color: 'ink' },
  ACCESS_TICKET_SCOPE_VIEW: { label: 'Visualizou dados via ticket', color: 'red' },
};

export default async function AuditPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');

  let me: any = null;
  let data: { actions: Action[]; retentionNote: string } | null = null;
  try {
    me = await apiFetch<any>('/api/auth/me', { accessToken: token });
    if (me.role !== 'SUPER_ADMIN') redirect('/dashboard');
    data = await apiFetch<{ actions: Action[]; retentionNote: string }>(
      '/api/superadmin/audit',
      { accessToken: token },
    );
  } catch (err) {
    if (err instanceof ApiClientError) redirect('/login');
    return <div className="card p-8 text-red-400">{(err as Error).message}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-ink-50">Audit Log</h1>
        </div>
        <p className="mt-1 text-sm text-ink-400">{data.retentionNote}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-700/50 bg-ink-900/40">
              <tr className="text-left text-2xs uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Metadata</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/30">
              {data.actions.map((a) => {
                const info = actionLabels[a.action] || { label: a.action, color: 'ink' };
                return (
                  <tr key={a.id} className="hover:bg-ink-900/30">
                    <td className="whitespace-nowrap px-4 py-3 text-2xs text-ink-400">
                      {new Date(a.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-ink-200">{a.superAdmin.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-2xs font-medium bg-${info.color}-500/10 text-${info.color}-400`}>
                        {info.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-ink-400">
                      {a.tenantId?.slice(0, 8) || '—'}
                    </td>
                    <td className="px-4 py-3 text-2xs text-ink-500">
                      {a.metadata && Object.keys(a.metadata).length > 0 ? (
                        <code>{JSON.stringify(a.metadata)}</code>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-ink-500">{a.ipAddress || '—'}</td>
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
