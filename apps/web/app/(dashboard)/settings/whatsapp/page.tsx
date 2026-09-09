import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { WhatsAppAccounts, type WhatsAppAccount } from '@/components/whatsapp/accounts';
import { InstagramField } from '@/components/whatsapp/InstagramField';

export default async function WhatsAppSettingsPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie contas WhatsApp via tenants.</div>;
  }

  const resp = await apiFetch<{ data?: WhatsAppAccount[] } | WhatsAppAccount[]>('/api/whatsapp/accounts', { accessToken: token }).catch(() => []);
  const accounts: WhatsAppAccount[] = Array.isArray(resp) ? resp : (resp.data || []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">WhatsApp</h1>
        <p className="mt-0.5 text-sm text-ink-400">Conecte números do WhatsApp via QR Code. Cada conta vira uma inbox separada.</p>
      </div>
      <WhatsAppAccounts initial={accounts} />
      <InstagramField />
    </div>
  );
}
