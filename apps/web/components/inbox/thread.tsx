'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, User as UserIcon, Hand, RotateCcw, X, Loader2, MessageSquare } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface Conversation {
  id: string;
  status: 'OPEN' | 'WITH_HUMAN' | 'WITH_AI' | 'CLOSED';
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  aiPaused: boolean;
  contact: { id: string; name: string; phone: string | null; email: string | null };
  whatsappAccount: { id: string; name: string; status: string } | null;
  assignedUser: { id: string; name: string } | null;
  lead: { id: string; title: string; stage: { id: string; name: string; color: string } } | null;
}

export interface Message {
  id: string;
  senderType: 'CONTACT' | 'USER' | 'AI' | 'SYSTEM';
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  senderUser: { id: string; name: string; avatarUrl: string | null } | null;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  WITH_AI: { label: 'IA atendendo', color: 'kairos' },
  WITH_HUMAN: { label: 'Humano', color: 'amber' },
  OPEN: { label: 'Aberta', color: 'blue' },
  CLOSED: { label: 'Fechada', color: 'ink' },
};

export function ConversationThread({ initialConversation, initialMessages }: { initialConversation: Conversation; initialMessages: Message[] }) {
  const router = useRouter();
  const [conv, setConv] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function refresh() {
    try {
      const c = await apiFetch<Conversation>(`/api/inbox/${conv.id}`);
      setConv(c);
      const m = await apiFetch<{ data: Message[] }>(`/api/inbox/${conv.id}/messages?limit=200`);
      setMessages(m.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function send() {
    if (!content.trim() || sending) return;
    setSending(true);
    const tmp = content;
    setContent('');
    try {
      const msg = await apiFetch<Message>(`/api/inbox/${conv.id}/messages`, {
        method: 'POST', body: { content: tmp },
      });
      setMessages([...messages, msg]);
    } catch (err) {
      alert((err as Error).message);
      setContent(tmp);
    } finally {
      setSending(false);
    }
  }

  async function doAction(action: 'takeover' | 'return' | 'close') {
    setActionLoading(true);
    try {
      await apiFetch(`/api/inbox/${conv.id}/${action}`, { method: 'POST' });
      await refresh();
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  const status = statusLabel[conv.status] || statusLabel.OPEN;

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-800/60 bg-ink-900/30 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-kairos-400 to-kairos-600 text-sm font-bold text-ink-950">
            {conv.contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-ink-100">{conv.contact.name}</h2>
              <span className={`rounded px-1.5 py-0.5 text-2xs font-medium bg-${status.color}-500/10 text-${status.color}-400`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-ink-500">{conv.contact.phone || conv.contact.email || '—'}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {conv.status !== 'WITH_HUMAN' && conv.status !== 'CLOSED' && (
            <button onClick={() => doAction('takeover')} disabled={actionLoading} className="btn-ghost text-xs">
              <Hand className="h-3.5 w-3.5" /> Assumir
            </button>
          )}
          {conv.status === 'WITH_HUMAN' && (
            <button onClick={() => doAction('return')} disabled={actionLoading} className="btn-ghost text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Devolver pra IA
            </button>
          )}
          {conv.status !== 'CLOSED' && (
            <button onClick={() => doAction('close')} disabled={actionLoading} className="btn-ghost text-xs">
              <X className="h-3.5 w-3.5" /> Fechar
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-ink-500">
            <div>
              <MessageSquare className="mx-auto h-10 w-10 text-ink-700" />
              <p className="mt-2 text-sm">Nenhuma mensagem ainda.</p>
            </div>
          </div>
        )}
        {messages.map((m) => {
          const fromContact = m.direction === 'INBOUND';
          return (
            <div key={m.id} className={`flex ${fromContact ? 'justify-start' : 'justify-end'}`}>
              <div className={`flex max-w-[70%] gap-2 ${fromContact ? '' : 'flex-row-reverse'}`}>
                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-2xs font-bold ${fromContact ? 'bg-ink-800 text-ink-300' : m.senderType === 'AI' ? 'bg-kairos-500/20 text-kairos-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {fromContact ? <UserIcon className="h-3.5 w-3.5" /> : m.senderType === 'AI' ? <Bot className="h-3.5 w-3.5" /> : 'V'}
                </div>
                <div>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${fromContact ? 'bg-ink-800/80 text-ink-100' : m.senderType === 'AI' ? 'bg-kairos-500/10 text-kairos-100 ring-1 ring-kairos-500/20' : 'bg-blue-500/10 text-blue-100 ring-1 ring-blue-500/20'}`}>
                    {m.content || <em className="text-ink-500">[mídia]</em>}
                  </div>
                  <p className="mt-1 px-1 text-2xs text-ink-600">
                    {new Date(m.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    {m.senderType === 'AI' && ' · Kairos IA'}
                    {m.senderType === 'USER' && m.senderUser && ` · ${m.senderUser.name.split(' ')[0]}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      {conv.status === 'CLOSED' ? (
        <div className="border-t border-ink-800/60 bg-ink-900/30 p-4 text-center text-sm text-ink-500">
          Conversa fechada.
        </div>
      ) : (
        <div className="border-t border-ink-800/60 bg-ink-900/30 p-3">
          {conv.status === 'WITH_AI' && (
            <p className="mb-2 text-2xs text-kairos-400">
              <Bot className="inline h-3 w-3" /> Kairos IA está respondendo. Clique em <strong>Assumir</strong> pra responder manualmente.
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Digite uma mensagem…"
              className="input flex-1"
              disabled={!conv.whatsappAccount || conv.whatsappAccount.status !== 'CONNECTED'}
            />
            <button onClick={send} disabled={sending || !content.trim() || !conv.whatsappAccount || conv.whatsappAccount.status !== 'CONNECTED'} className="btn-primary">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {conv.whatsappAccount && conv.whatsappAccount.status !== 'CONNECTED' && (
            <p className="mt-2 text-2xs text-amber-400">WhatsApp desconectado. Vá em Configurações → WhatsApp pra reconectar.</p>
          )}
        </div>
      )}
    </div>
  );
}
