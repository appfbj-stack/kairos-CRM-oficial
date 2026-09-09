'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check, X, MessageSquare, Users, CheckSquare, Clock, Zap, AtSign, Hand, Lock } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  icon: string | null;
  read: boolean;
  createdAt: string;
}

const ICON_MAP: Record<string, any> = {
  MessageSquare, Users, CheckSquare, Clock, Zap, AtSign, Hand, Lock,
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load(silent = false) {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json();
      setList(j.notifications || []);
      setUnread(j.unreadCount || 0);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markRead(id: string) {
    setList((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' }); } catch {}
  }

  async function markAll() {
    setList((l) => l.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }); } catch {}
  }

  async function remove(id: string, wasRead: boolean) {
    setList((l) => l.filter((n) => n.id !== id));
    if (!wasRead) setUnread((u) => Math.max(0, u - 1));
    try { await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' }); } catch {}
  }

  function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return `${Math.floor(s / 60)}m atrás`;
    if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
    return `${Math.floor(s / 86400)}d atrás`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-ink-800/60 hover:text-ink-100"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-ink-700/50 bg-ink-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink-700/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-100">Notificações</h3>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-2xs text-kairos-400 hover:text-kairos-300"
              >
                <Check className="h-3 w-3" /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {list.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-ink-700" />
                <p className="mt-2 text-sm text-ink-500">Nenhuma notificação</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-700/30">
                {list.map((n) => {
                  const Icon = ICON_MAP[n.icon || 'MessageSquare'] || MessageSquare;
                  return (
                    <li
                      key={n.id}
                      className={`group relative px-4 py-3 hover:bg-ink-800/40 ${!n.read ? 'bg-kairos-500/5' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          !n.read ? 'bg-kairos-500/10 text-kairos-400' : 'bg-ink-800/50 text-ink-500'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => { markRead(n.id); setOpen(false); }}
                              className="block"
                            >
                              <p className={`text-sm ${!n.read ? 'font-medium text-ink-100' : 'text-ink-300'}`}>
                                {n.title}
                              </p>
                              {n.body && (
                                <p className="mt-0.5 truncate text-2xs text-ink-500">{n.body}</p>
                              )}
                              <p className="mt-1 text-2xs text-ink-600">{timeAgo(n.createdAt)}</p>
                            </Link>
                          ) : (
                            <>
                              <p className={`text-sm ${!n.read ? 'font-medium text-ink-100' : 'text-ink-300'}`}>
                                {n.title}
                              </p>
                              {n.body && (
                                <p className="mt-0.5 truncate text-2xs text-ink-500">{n.body}</p>
                              )}
                              <p className="mt-1 text-2xs text-ink-600">{timeAgo(n.createdAt)}</p>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => remove(n.id, n.read)}
                          className="opacity-0 group-hover:opacity-100 text-ink-600 hover:text-red-400"
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
