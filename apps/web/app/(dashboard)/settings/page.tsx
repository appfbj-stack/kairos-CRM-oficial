import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { SettingsPanels, type MeUser, type UserRow, type AuditEntry } from '@/components/settings/panels';

export default async function SettingsPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie via tenants.</div>;
  }

  const canManageUsers = ['TENANT_ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(me.role);

  const [meFull, usersResp, auditResp] = await Promise.all([
    apiFetch<MeUser>('/api/users/me', { accessToken: token }),
    canManageUsers
      ? apiFetch<{ data: UserRow[] }>('/api/users', { accessToken: token }).catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] as UserRow[] }),
    canManageUsers
      ? apiFetch<{ data: AuditEntry[] }>('/api/audit?limit=100', { accessToken: token }).catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] as AuditEntry[] }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Configurações</h1>
        <p className="mt-0.5 text-sm text-ink-400">Perfil, senha, equipe e auditoria do {me.tenantName}.</p>
      </div>
      <SettingsPanels me={meFull} users={usersResp.data} audit={auditResp.data} canManageUsers={canManageUsers} />
    </div>
  );
}
