import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { HermesConfig, type AIConfig } from '@/components/hermes/config';

export default async function HermesPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie IA via tenants.</div>;
  }

  const cfg = await apiFetch<AIConfig | null>('/api/hermes/config', { accessToken: token }).catch(() => null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Kairos IA</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          Configure o cérebro da Kairos IA: provider LLM, personalidade, objetivos. Quando conectada ao WhatsApp, ela responde sozinha e executa ações no CRM.
        </p>
      </div>
      <HermesConfig initial={cfg} />
    </div>
  );
}
