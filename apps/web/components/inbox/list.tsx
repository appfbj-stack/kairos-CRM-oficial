'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Inbox, Bot, Hand, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Conversation } from './thread';

const statusIcon: Record<string, any> = {
  WITH_AI: Bot,
  WITH_HUMAN: Hand,
  OPEN: Inbox,
  CLOSED: CheckCircle2,
};
const statusColor: Record<string, string> = {
  WITH_AI: 'text-kairos-400',
  WITH_HUMAN: 'text-amber-400',
  OPEN: 'text-blue-400',
  CLOSED: 'text-ink-500',
};

export function ConversationList({ initial, currentId }: { initial: Conversation[]; currentId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');

  const filtered = items.filter((c) => {
    if (statusFilter === 'OPEN' && c.status === 'CLOSED') return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.contact.name.toLowerCase().includes(q) ||
      c.contact.phone?.toLowerCase().includes(q) ||
      c.lastMessagePreview?.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="border-b border-ink-800/60 p-3">
        <h1 className="mb-2 text-xl font-bold text-ink-50">Conversas</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa…"
            className="input pl-9 text-sm"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {[
            { k: 'OPEN', l: 'Abertas' },
            { k: 'WITH_AI', l: 'IA' },
            { k: 'WITH_HUMAN', l: 'Humanas' },
            { k: 'CLOSED', l: 'Fechadas' },
            { k: 'ALL', l: 'Todas' },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setStatusFilter(f.k)}
              className={`rounded-full px-2.5 py-0.5 text-2xs font-medium transition ${statusFilter === f.k ? 'bg-kairos-500/20 text-kairos-300' : 'text-ink-500 hover:text-ink-200'}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-ink-500">
            Nenhuma conversa.
          </div>
        )}
        {filtered.map((c) => {
          const Icon = statusIcon[c.status] || Inbox;
          const isActive = currentId === c.id || pathname === `/inbox/${c.id}`;
          return (
            <Link
              key={c.id}
              href={`/inbox/${c.id}`}
              className={`block border-b border-ink-800/40 p-3 transition hover:bg-ink-900/40 ${isActive ? 'bg-ink-900/60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-kairos-400 to-kairos-600 text-sm font-bold text-ink-950">
                  {c.contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink-100">{c.contact.name}</p>
                    <span className="shrink-0 text-2xs text-ink-600">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 ${statusColor[c.status] || 'text-ink-500'}`} />
                    <p className="truncate text-xs text-ink-500">
                      {c.lastMessagePreview || c.contact.phone || '—'}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="mt-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-kairos-500 px-1.5 text-2xs font-bold text-ink-950">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
