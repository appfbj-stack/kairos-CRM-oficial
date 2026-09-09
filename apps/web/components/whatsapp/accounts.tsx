'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Smartphone, RefreshCw, Power, Trash2, QrCode, Loader2, Wifi, WifiOff, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface WhatsAppAccount {
  id: string;
  name: string;
  provider: string;
  instanceId: string;
  phone: string | null;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  createdAt: string;
  _count: { conversations: number };
}

const statusBadge: Record<string, { label: string; color: string; icon: any }> = {
  CONNECTED: { label: 'Conectado', color: 'kairos', icon: Wifi },
  CONNECTING: { label: 'Conectando…', color: 'amber', icon: Loader2 },
  DISCONNECTED: { label: 'Desconectado', color: 'ink', icon: WifiOff },
  ERROR: { label: 'Erro', color: 'red', icon: WifiOff },
};

export function WhatsAppAccounts({ initial }: { initial: WhatsAppAccount[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrAge, setQrAge] = useState(0); // segundos desde o QR atual
  const [secondsToRefresh, setSecondsToRefresh] = useState(0);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch<WhatsAppAccount>('/api/whatsapp/accounts', {
        method: 'POST',
        body: { name, number: number || undefined },
      });
      setItems([{ ...created, _count: { conversations: 0 } }, ...items]);
      setShowForm(false);
      setName(''); setNumber('');
      // Abre o QR direto da conta nova
      setQrOpen(created.id);
      await getQR(created.id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function getQR(id: string) {
    setLoading(true);
    setQrOpen(id);
    setQrCode(null);
    setPairingCode(null);
    setQrAge(0);
    setSecondsToRefresh(25);
    try {
      const res = await apiFetch<{ qrCode: string | null; pairingCode: string | null }>(`/api/whatsapp/accounts/${id}/connect`, {
        method: 'POST',
      });
      setQrCode(res.qrCode);
      setPairingCode(res.pairingCode);
    } catch (err) {
      alert((err as Error).message);
      setQrOpen(null);
    } finally {
      setLoading(false);
    }
  }

  // Polling leve: status a cada 5s, fecha modal só se conectou
  useEffect(() => {
    if (!qrOpen) return;
    let cancelled = false;
    let statusTimer: any;

    statusTimer = setInterval(async () => {
      if (cancelled) return;
      try {
        const updated = await apiFetch<WhatsAppAccount>(`/api/whatsapp/accounts/${qrOpen}/refresh`, { method: 'POST' });
        if (cancelled) return;
        setItems((prev) => prev.map((i) => (i.id === qrOpen ? { ...i, ...updated } : i)));
        if (updated.status === 'CONNECTED') {
          setQrOpen(null);
        }
      } catch {}
    }, 5_000);

    return () => {
      cancelled = true;
      clearInterval(statusTimer);
    };
  }, [qrOpen]);

  async function refreshStatus(id: string) {
    try {
      const updated = await apiFetch<WhatsAppAccount>(`/api/whatsapp/accounts/${id}/refresh`, { method: 'POST' });
      setItems(items.map((i) => i.id === id ? { ...i, ...updated } : i));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function forceConnect(id: string) {
    if (!confirm('Forçar conexão? Útil pra testes sem escanear QR. (A conta será marcada como conectada, mas só receberá mensagens se o webhook da Evolution estiver apontando pra cá.)')) return;
    try {
      const updated = await apiFetch<WhatsAppAccount>(`/api/whatsapp/accounts/${id}/force-connect`, { method: 'POST', body: {} });
      setItems(items.map((i) => i.id === id ? { ...i, ...updated } : i));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function logout(id: string) {
    if (!confirm('Desconectar este WhatsApp?')) return;
    try {
      const updated = await apiFetch<WhatsAppAccount>(`/api/whatsapp/accounts/${id}/logout`, { method: 'POST' });
      setItems(items.map((i) => i.id === id ? { ...i, ...updated } : i));
      setQrOpen(null);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta conta? As conversas permanecem no histórico.')) return;
    try {
      await apiFetch(`/api/whatsapp/accounts/${id}`, { method: 'DELETE' });
      setItems(items.filter((i) => i.id !== id));
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{items.length} conta{items.length !== 1 ? 's' : ''} cadastrada{items.length !== 1 ? 's' : ''}.</p>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Nova conta
        </button>
      </div>

      {items.length === 0 && (
        <div className="card p-10 text-center">
          <Smartphone className="mx-auto h-12 w-12 text-ink-700" />
          <h2 className="mt-4 text-lg font-semibold text-ink-100">Nenhuma conta WhatsApp</h2>
          <p className="mt-1 text-sm text-ink-400">Conecte um número para começar a receber mensagens.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
            <Plus className="h-4 w-4" /> Conectar WhatsApp
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((acc) => {
          const s = statusBadge[acc.status] || statusBadge.DISCONNECTED;
          return (
            <div key={acc.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-lg bg-${s.color}-500/10`}>
                    <s.icon className={`h-5 w-5 text-${s.color}-400 ${acc.status === 'CONNECTING' ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-100">{acc.name}</h3>
                    <p className="text-xs text-ink-500">{acc.phone || acc.instanceId}</p>
                  </div>
                </div>
                <span className={`rounded px-2 py-0.5 text-2xs font-medium bg-${s.color}-500/10 text-${s.color}-400`}>{s.label}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-ink-900/40 p-2">
                  <p className="text-2xs text-ink-500">Conversas</p>
                  <p className="font-mono text-ink-200">{acc._count.conversations}</p>
                </div>
                <div className="rounded bg-ink-900/40 p-2">
                  <p className="text-2xs text-ink-500">Provider</p>
                  <p className="font-mono text-ink-200">{acc.provider}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {acc.status !== 'CONNECTED' && (
                  <button onClick={() => getQR(acc.id)} className="btn-primary flex-1 text-xs">
                    <QrCode className="h-3.5 w-3.5" /> Conectar
                  </button>
                )}
                <button onClick={() => refreshStatus(acc.id)} className="btn-ghost text-xs" title="Atualizar status">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                {acc.status === 'CONNECTED' && (
                  <button onClick={() => logout(acc.id)} className="btn-ghost text-xs" title="Desconectar">
                    <Power className="h-3.5 w-3.5" />
                  </button>
                )}
                {acc.status === 'DISCONNECTED' && (
                  <button onClick={() => forceConnect(acc.id)} className="btn-ghost text-xs" title="Forçar conexão (teste)">
                    <Wifi className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => remove(acc.id)} className="btn-ghost text-xs text-red-400 hover:bg-red-500/10" title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">Nova conta WhatsApp</h2>
            <p className="mt-1 text-sm text-ink-400">Vamos criar uma instância na Evolution e te dar o QR pra conectar.</p>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Nome (ex: WhatsApp Vendas) *" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input" placeholder="Número (opcional, com DDD)" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={create} disabled={saving || !name.trim()} className="btn-primary">
                {saving ? 'Criando…' : 'Criar e gerar QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div className="card w-full max-w-md p-6 text-center">
            <h2 className="text-lg font-semibold text-ink-50">Conectar WhatsApp</h2>
            <p className="mt-1 text-sm text-ink-400">Abra o WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho.</p>
            {loading && !qrCode ? (
              <div className="my-10 grid place-items-center">
                <Loader2 className="h-10 w-10 animate-spin text-kairos-400" />
                <p className="mt-3 text-sm text-ink-400">Gerando QR…</p>
              </div>
            ) : qrCode ? (
              <>
                <div className="mt-4 grid place-items-center">
                  <div className="rounded-lg bg-white p-4">
                    <img
                      key={qrCode.slice(-32)}
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code"
                      className="h-64 w-64"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-2xs text-ink-500">
                  <Clock className="h-3 w-3" />
                  <span>
                    Se não conectar, clique <strong>Atualizar QR</strong> abaixo
                  </span>
                </div>
                {pairingCode && (
                  <div className="mt-4 rounded-lg bg-ink-900/50 p-3">
                    <p className="text-2xs text-ink-500">Ou use o código de pareamento:</p>
                    <p className="mt-1 break-all font-mono text-sm font-bold text-kairos-400">{pairingCode}</p>
                  </div>
                )}
                <p className="mt-4 text-2xs text-ink-500">O modal fecha sozinho quando conectar. Pode deixar aberto.</p>
              </>
            ) : (
              <p className="my-10 text-sm text-amber-400">QR não gerado. Tente de novo.</p>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={() => getQR(qrOpen)} disabled={loading} className="btn-ghost text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar QR
              </button>
              <button onClick={() => setQrOpen(null)} className="btn-ghost text-xs">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
