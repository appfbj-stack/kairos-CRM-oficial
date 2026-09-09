import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { AutomationsTabs, type Automation, type FollowUp, type Appointment } from '@/components/automations/tabs';

export default async function AutomationsPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie automações via tenants.</div>;
  }

  const [automations, followups, appointments, contactsResp] = await Promise.all([
    apiFetch<{ data: Automation[] }>('/api/automations?limit=50', { accessToken: token }).catch(() => ({ data: [] })),
    apiFetch<{ data: FollowUp[] }>('/api/followups?limit=50', { accessToken: token }).catch(() => ({ data: [] })),
    apiFetch<{ data: Appointment[] }>('/api/appointments?limit=50', { accessToken: token }).catch(() => ({ data: [] })),
    apiFetch<{ data: any[] }>('/api/crm/contacts?limit=200', { accessToken: token }).catch(() => ({ data: [] })),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Automações</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          Templates de regras, follow-ups agendados e agenda de compromissos — tudo num lugar só.
        </p>
      </div>
      <AutomationsTabs
        initialAutomations={automations.data}
        initialFollowUps={followups.data}
        initialAppointments={appointments.data}
        contacts={contactsResp.data.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone }))}
      />
    </div>
  );
}
