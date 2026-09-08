import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { KnowledgeTable, type Knowledge } from '@/components/knowledge/table';

export default async function KnowledgePage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie knowledge via tenants.</div>;
  }

  const resp = await apiFetch<{ data: Knowledge[] }>('/api/knowledge?limit=200', { accessToken: token }).catch(() => ({ data: [] }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Base de conhecimento</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          Perguntas e respostas que a Kairos IA consulta automaticamente quando o cliente perguntar algo.
        </p>
      </div>
      <KnowledgeTable initial={resp.data} />
    </div>
  );
}
