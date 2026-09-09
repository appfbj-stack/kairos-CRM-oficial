/**
 * Access Tickets - LGPD Art. 37/38
 * Lista todos os tickets de acesso a dados sensíveis.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Lock, Eye } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, ApiClientError } from '@/lib/api';

interface Ticket {
  id: string;
  tenantId: string;
  openedBy: string;
  authorizedBy: string | null;
  reason: string;
  scope: string;
  status: string;
  expiresAt: string;
  accessedData: any;
  ipAddress: string | null;
  createdAt: string;
  closedAt: string | null;
  tenant: { id: string; name: string; slug: string };
}

export default async function AccessTicketsPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');

  let me: any = null;
  let data: { tickets: Ticket[] } | null = null;
  try {
    me = await apiFetch<any>('/api/auth/me', { accessToken: token });
    if (me.role !== 'SUPER_ADMIN') redirect('/dashboard');
    data = await apiFetch<{ tickets: Ticket[] }>('/api/superadmin/access-tickets', { accessToken: token });
  } catch (err) {
    if (err instanceof ApiClientError) redirect('/login');
    return <div className="card p-8 text-red-400">{(err as Error).message}</div>;
  }

  if (!data) return null;
  const open = data.tickets.filter((t) => t.status === 'OPEN');
  const closed = data.tickets.filter((t) => t.status !== 'OPEN');

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <FileText className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-ink-50">Access Tickets</h1>
        </div>
        <p className="mt-1 text-sm text-ink-400">
          Registro de todos os acessos a dados pessoais de tenants (LGPD Art. 37, 38).
        </p>
      </div>

      <div className="card border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 text-amber-400 mt-0.5" />
          <p className="text-sm text-ink-300">
            Cada ticket concede acesso limitado a dados pessoais por um prazo definido.
            Visualizações dentro do ticket são logadas separadamente.
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-700/50 bg-ink-900/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-200">Tickets abertos ({open.length})</h2>
        </div>
        {open.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-500">Nenhum ticket aberto.</p>
        ) : (
          <ul className="divide-y divide-ink-700/30">
            {open.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-400">
                        {t.scope}
                      </span>
                      <Link href={`/super-admin/tenants/${t.tenantId}`} className="font-medium text-ink-100 hover:text-kairos-400">
                        {t.tenant.name}
                      </Link>
                    </div>
                    <p className="mt-2 text-sm text-ink-300">{t.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-500">
                      <span>📅 Criado: {new Date(t.createdAt).toLocaleString('pt-BR')}</span>
                      <span>⏰ Expira: {new Date(t.expiresAt).toLocaleString('pt-BR')}</span>
                      {t.authorizedBy && <span>✍️ Autorizado por: {t.authorizedBy}</span>}
                      {t.ipAddress && <span>🌐 IP: {t.ipAddress}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/super-admin/access-tickets/${t.id}`}
                      className="btn-ghost text-2xs"
                    >
                      <Eye className="h-3 w-3" /> Visualizar
                    </Link>
                    <CloseTicketButton ticketId={t.id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-700/50 bg-ink-900/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-400">Histórico ({closed.length})</h2>
        </div>
        {closed.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-500">Nenhum ticket fechado.</p>
        ) : (
          <ul className="divide-y divide-ink-700/30">
            {closed.map((t) => (
              <li key={t.id} className="p-4 opacity-60">
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-ink-700/30 px-2 py-0.5 text-2xs text-ink-400">
                    {t.scope}
                  </span>
                  <span className="text-ink-300">{t.tenant.name}</span>
                  <span className="text-2xs text-ink-500">
                    {t.authorizedBy || 'sem autorizador'} · {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import CloseTicketButton from './CloseTicketButton';
