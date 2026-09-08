'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, User as UserIcon, Key, Users as UsersIcon, History, Plus, Trash2, Power, PowerOff, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface MeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantPlan?: string;
  tenantStatus?: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

const ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'AGENT', 'USER'];
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Admin do tenant',
  MANAGER: 'Gerente',
  AGENT: 'Atendente',
  USER: 'Usuário',
};

export function SettingsPanels({ me, users, audit, canManageUsers }: { me: MeUser; users: UserRow[]; audit: AuditEntry[]; canManageUsers: boolean }) {
  const [tab, setTab] = useState<'profile' | 'password' | 'users' | 'audit'>('profile');
  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-ink-800/60">
        {[
          { k: 'profile' as const, l: 'Perfil', icon: UserIcon },
          { k: 'password' as const, l: 'Senha', icon: Key },
          { k: 'users' as const, l: `Usuários (${users.length})`, icon: UsersIcon, adminOnly: true },
          { k: 'audit' as const, l: 'Auditoria', icon: History, adminOnly: true },
        ].filter((t) => !t.adminOnly || canManageUsers).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition ${tab === t.k ? 'border-kairos-400 text-kairos-300' : 'border-transparent text-ink-500 hover:text-ink-200'}`}>
            <t.icon className="h-4 w-4" /> {t.l}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfilePanel me={me} />}
      {tab === 'password' && <PasswordPanel />}
      {tab === 'users' && canManageUsers && <UsersPanel initial={users} />}
      {tab === 'audit' && canManageUsers && <AuditPanel initial={audit} />}
    </div>
  );
}

function ProfilePanel({ me }: { me: MeUser }) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-kairos-400 to-kairos-600 text-2xl font-bold text-ink-950">
          {me.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink-50">{me.name}</h2>
          <p className="text-sm text-ink-400">{me.email}</p>
          <p className="mt-1 text-xs text-ink-500">{ROLE_LABEL[me.role] || me.role}</p>
        </div>
      </div>
      {me.tenantName && (
        <div className="border-t border-ink-800/60 pt-4">
          <h3 className="text-sm font-semibold text-ink-200">Tenant</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <Info label="Nome" value={me.tenantName} />
            <Info label="Slug" value={me.tenantSlug || '—'} />
            <Info label="Plano" value={me.tenantPlan || '—'} />
            <Info label="Status" value={me.tenantStatus || '—'} />
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-900/40 px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 text-ink-200">{value}</div>
    </div>
  );
}

function PasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function change() {
    if (next !== confirm) { setMsg({ ok: false, text: 'Confirmação não confere' }); return; }
    if (next.length < 8) { setMsg({ ok: false, text: 'Senha deve ter pelo menos 8 caracteres' }); return; }
    setSaving(true); setMsg(null);
    try {
      await apiFetch('/api/users/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setMsg({ ok: true, text: 'Senha alterada com sucesso' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6 max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-ink-50">Trocar minha senha</h2>
      <div>
        <label className="text-2xs uppercase tracking-wider text-ink-500">Senha atual</label>
        <input type="password" className="input mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="text-2xs uppercase tracking-wider text-ink-500">Nova senha (mín. 8)</label>
        <input type="password" className="input mt-1" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div>
        <label className="text-2xs uppercase tracking-wider text-ink-500">Confirmação</label>
        <input type="password" className="input mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {msg && (
        <div className={`rounded p-2 text-sm ${msg.ok ? 'bg-kairos-500/10 text-kairos-400' : 'bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}
      <button onClick={change} disabled={saving || !current || !next || !confirm} className="btn-primary">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar
      </button>
    </div>
  );
}

function UsersPanel({ initial }: { initial: UserRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT' });

  async function save() {
    setSaving(true);
    try {
      const created = await apiFetch<UserRow>('/api/users', { method: 'POST', body: form });
      setItems([...items, created]);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'AGENT' });
      router.refresh();
    } catch (err) { alert((err as Error).message); } finally { setSaving(false); }
  }

  async function toggleStatus(u: UserRow) {
    try {
      const updated = await apiFetch<UserRow>(`/api/users/${u.id}`, {
        method: 'PATCH', body: { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
      });
      setItems(items.map((i) => i.id === u.id ? updated : i));
    } catch (err) { alert((err as Error).message); }
  }

  async function changeRole(u: UserRow, role: string) {
    try {
      const updated = await apiFetch<UserRow>(`/api/users/${u.id}`, { method: 'PATCH', body: { role } });
      setItems(items.map((i) => i.id === u.id ? updated : i));
    } catch (err) { alert((err as Error).message); }
  }

  async function remove(u: UserRow) {
    if (!confirm(`Excluir ${u.name}?`)) return;
    try {
      await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
      setItems(items.filter((i) => i.id !== u.id));
      router.refresh();
    } catch (err) { alert((err as Error).message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{items.length} usuário{items.length !== 1 ? 's' : ''} no tenant.</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Convidar
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800/60 bg-ink-900/40 text-left text-2xs font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-4 py-3">Pessoa</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-ink-800/40 last:border-0 hover:bg-ink-900/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-100">{u.name}</div>
                  <div className="text-xs text-ink-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select className="input text-xs" value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${u.status === 'ACTIVE' ? 'bg-kairos-500/10 text-kairos-400' : 'bg-ink-800 text-ink-500'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-ink-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toggleStatus(u)} className="rounded p-1.5 text-ink-500 hover:bg-ink-800" title={u.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}>
                      {u.status === 'ACTIVE' ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => remove(u)} className="rounded p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">Convidar usuário</h2>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input" type="password" placeholder="Senha (mín. 8) *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name || !form.email || !form.password || form.password.length < 8} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Convidar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditPanel({ initial }: { initial: AuditEntry[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-400">{initial.length} ações registradas (últimas 100).</p>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800/60 bg-ink-900/40 text-left text-2xs font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Quem</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">Nenhuma ação registrada.</td></tr>
            )}
            {initial.map((a) => (
              <tr key={a.id} className="border-b border-ink-800/40 last:border-0">
                <td className="px-4 py-2 text-xs text-ink-400">{new Date(a.createdAt).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-2 text-ink-300">{a.user?.name || '—'}</td>
                <td className="px-4 py-2 font-mono text-2xs text-ink-200">{a.action}</td>
                <td className="px-4 py-2 text-2xs text-ink-500">{a.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
