import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { ConversationList } from '@/components/inbox/list';
import type { Conversation } from '@/components/inbox/thread';

export default async function InboxPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: visualize conversas via tenants.</div>;
  }

  const resp = await apiFetch<{ data: Conversation[] }>('/api/inbox?limit=100', { accessToken: token }).catch(() => ({ data: [] }));

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="card overflow-hidden">
        <ConversationList initial={resp.data} />
      </div>
      <div className="card hidden items-center justify-center lg:flex">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink-900/50">
            <span className="text-3xl">💬</span>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink-100">Selecione uma conversa</h2>
          <p className="mt-1 text-sm text-ink-500">Ou aguarde novas mensagens chegarem pelo WhatsApp.</p>
        </div>
      </div>
    </div>
  );
}
