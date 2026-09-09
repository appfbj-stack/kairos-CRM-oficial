'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, Power, PowerOff, CreditCard, KeyRound, FileText, AlertTriangle, Loader2 } from 'lucide-react';

interface TenantDetail {
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
  metrics: Record<string, number>;
  complianceNote: string;
}

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);

  // Form state
  const [ticketReason, setTicketReason] = useState('');
  const [ticketAuthBy, setTicketAuthBy] = useState('');
  const [ticketScope, setTicketScope] = useState('all');
  const [ticketHours, setTicketHours] = useState(24);
  const [newPwd, setNewPwd] = useState('');
  const [targetUserId, setTargetUserId] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}/overview`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      // Tenta carregar users (não-bloqueante)
      fetch(`/api/superadmin/tenants/${id}/users`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((j) => setUsers(j.users || []))
        .catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function doAction(path: string, body: any = {}) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/superadmin${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `HTTP ${res.status}`);
      }
      await load();
      router.refresh();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function openTicket() {
    if (ticketReason.length < 20) {
      alert('Motivo precisa ter pelo menos 20 caracteres (LGPD Art. 37).');
      return;
    }
    await doAction('/access-tickets', {
      tenantId: id, reason: ticketReason, authorizedBy: ticketAuthBy,
      scope: ticketScope, expiresInHours: ticketHours,
    });
    setShowTicket(false);
    setTicketReason(''); setTicketAuthBy('');
    alert('Ticket aberto. Acesse "Access Tickets" para visualizar dados sensíveis.');
  }

  async function resetPassword() {
    if (newPwd.length < 8) { alert('Senha deve ter no mínimo 8 caracteres'); return; }
    if (!targetUserId) { alert('Selecione um usuário'); return; }
    if (!confirm(`Resetar senha do usuário ${targetUserId}?`)) return;
    await doAction(`/users/${targetUserId}/reset-password`, { newPassword: newPwd });
    setShowResetPwd(false);
    setNewPwd('');
    alert('Senha resetada. Usuário precisará logar novamente.');
  }

  if (loading) {
    return (
      <div className="grid place-items-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-kairos-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8">
        <h1 className="text-lg font-semibold text-red-400">Erro</h1>
        <p className="mt-2 text-sm text-ink-400">{error}</p>
        <Link href="/super-admin" className="btn-ghost mt-4 text-sm">← Voltar</Link>
      </div>
    );
  }

  const isActive = data.status === 'ACTIVE' || data.status === 'TRIAL';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200">
          <ArrowLeft className="h-3 w-3" /> Voltar ao painel
        </Link>
        <div className="mt-3 flex items-center gap-3">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt="" className="h-10 w-10 rounded" />
          ) : (
            <div
              className="grid h-10 w-10 place-items-center rounded font-bold text-white"
              style={{ backgroundColor: data.primaryColor || '#10b981' }}
            >{data.name[0]?.toUpperCase()}</div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-ink-50">{data.name}</h1>
            <p className="text-sm text-ink-400">{data.slug} · {data.email}</p>
          </div>
        </div>
      </div>

      <div className="card border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-amber-400 mt-0.5" />
          <p className="text-sm text-ink-300">{data.complianceNote}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Ações administrativas</h2>
        <p className="mt-1 text-2xs text-ink-500">Todas as ações são logadas e retidas por 5 anos.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {isActive ? (
            <button onClick={() => { if (confirm('Desativar este tenant?')) doAction(`/tenants/${id}/disable`); }}
              disabled={actionLoading} className="btn-ghost text-sm">
              <PowerOff className="h-4 w-4 text-amber-400" /> Desativar tenant
            </button>
          ) : (
            <button onClick={() => doAction(`/tenants/${id}/enable`)}
              disabled={actionLoading} className="btn-ghost text-sm">
              <Power className="h-4 w-4 text-kairos-400" /> Reativar tenant
            </button>
          )}

          <div className="relative">
            <select
              value={data.plan}
              onChange={(e) => { if (confirm(`Mudar plano para ${e.target.value}?`)) doAction(`/tenants/${id}/change-plan`, { plan: e.target.value }); }}
              disabled={actionLoading}
              className="input pr-8 text-sm"
            >
              <option value="FREE">FREE</option>
              <option value="BASIC">BASIC</option>
              <option value="PRO">PRO</option>
              <option value="PREMIUM">PREMIUM</option>
            </select>
            <CreditCard className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500 pointer-events-none" />
          </div>

          <button onClick={() => setShowResetPwd(true)} className="btn-ghost text-sm">
            <KeyRound className="h-4 w-4" /> Resetar senha
          </button>

          <button onClick={() => setShowTicket(true)} className="btn-primary text-sm">
            <FileText className="h-4 w-4" /> Abrir Access Ticket
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Métricas agregadas</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(data.metrics).map(([k, v]) => (
            <div key={k} className="rounded bg-ink-900/40 p-3">
              <p className="text-2xs text-ink-500">{k}</p>
              <p className="text-xl font-bold font-mono text-ink-100">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Access Ticket */}
      {showTicket && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-ink-50">Abrir Access Ticket (LGPD Art. 37)</h2>
            <p className="mt-1 text-sm text-ink-400">
              Para visualizar dados pessoais deste tenant, preencha o motivo, autorizador e prazo.
              Tudo será logado e retido por 5 anos.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-2xs uppercase text-ink-500">Escopo dos dados *</label>
                <select value={ticketScope} onChange={(e) => setTicketScope(e.target.value)} className="input mt-1">
                  <option value="all">Todos</option>
                  <option value="leads">Leads</option>
                  <option value="conversations">Conversas</option>
                  <option value="contacts">Contatos</option>
                  <option value="messages">Mensagens</option>
                </select>
              </div>
              <div>
                <label className="text-2xs uppercase text-ink-500">Motivo (mín. 20 caracteres) *</label>
                <textarea
                  value={ticketReason} onChange={(e) => setTicketReason(e.target.value)}
                  placeholder="Ex: Cliente reportou bug no funil de vendas, preciso investigar os leads do pipeline X"
                  className="input mt-1 h-24 resize-none"
                />
                <p className="mt-1 text-2xs text-ink-500">{ticketReason.length} / 20+</p>
              </div>
              <div>
                <label className="text-2xs uppercase text-ink-500">Autorizado por (email) *</label>
                <input
                  type="email" value={ticketAuthBy} onChange={(e) => setTicketAuthBy(e.target.value)}
                  placeholder="cliente@empresa.com" className="input mt-1"
                />
              </div>
              <div>
                <label className="text-2xs uppercase text-ink-500">Prazo (horas, máx 168 = 7 dias)</label>
                <input
                  type="number" min={1} max={168} value={ticketHours}
                  onChange={(e) => setTicketHours(parseInt(e.target.value || '24'))}
                  className="input mt-1"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowTicket(false)} className="btn-ghost">Cancelar</button>
              <button onClick={openTicket} className="btn-primary">Abrir ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset senha */}
      {showResetPwd && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">Resetar senha</h2>
            <p className="mt-1 text-sm text-ink-400">Ação logada. Usuário será deslogado.</p>
            <div className="mt-4 space-y-3">
              {users.length === 0 ? (
                <p className="text-sm text-amber-400">
                  <AlertTriangle className="inline h-3 w-3" /> Lista de usuários não carregou.
                  Use o ID manualmente.
                </p>
              ) : (
                <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="input">
                  <option value="">Selecione um usuário</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email}) — {u.role}</option>
                  ))}
                </select>
              )}
              <input
                type="text" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Nova senha (mín. 8 caracteres)"
                className="input"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowResetPwd(false)} className="btn-ghost">Cancelar</button>
              <button onClick={resetPassword} className="btn-primary">Resetar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
