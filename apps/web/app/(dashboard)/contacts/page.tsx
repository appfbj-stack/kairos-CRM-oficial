import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { ContactsTable, type Contact } from '@/components/contacts/table';

export default async function ContactsPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie contatos via tenants.</div>;
  }

  const resp = await apiFetch<{ data: any[] }>('/api/crm/contacts?limit=100', { accessToken: token }).catch(() => ({ data: [] }));
  const contacts: Contact[] = resp.data as any;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Contatos</h1>
        <p className="mt-0.5 text-sm text-ink-400">{contacts.length} contato{contacts.length !== 1 ? 's' : ''} no {me.tenantName}.</p>
      </div>
      <ContactsTable initial={contacts} />
    </div>
  );
}
