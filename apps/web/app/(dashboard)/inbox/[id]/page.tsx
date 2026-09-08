import { redirect, notFound } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch, ApiClientError } from '@/lib/api';
import { ConversationThread, type Conversation, type Message } from '@/components/inbox/thread';
import { ConversationList } from '@/components/inbox/list';

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) redirect('/inbox');

  const [convResp, msgsResp, listResp] = await Promise.all([
    apiFetch<Conversation>(`/api/inbox/${params.id}`, { accessToken: token }),
    apiFetch<{ data: Message[] }>(`/api/inbox/${params.id}/messages?limit=200`, { accessToken: token }),
    apiFetch<{ data: Conversation[] }>('/api/inbox?limit=100', { accessToken: token }),
  ]).catch((err) => {
    if (err instanceof ApiClientError && err.status === 404) return [null, null, null];
    throw err;
  });

  if (!convResp || !msgsResp || !listResp) notFound();

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="card overflow-hidden">
        <ConversationList initial={listResp.data} currentId={params.id} />
      </div>
      <div className="card overflow-hidden">
        <ConversationThread initialConversation={convResp} initialMessages={msgsResp.data} />
      </div>
    </div>
  );
}
