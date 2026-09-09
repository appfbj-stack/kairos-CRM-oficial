'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Loader2, AlertTriangle } from 'lucide-react';

interface ScopeData {
  ticket: {
    id: string;
    reason: string;
    authorizedBy: string | null;
    scope: string;
    expiresAt: string;
  };
  counters: Record<string, number>;
  complianceNote: string;
}

export default function TicketScopePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ScopeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewed, setViewed] = useState(false);

  async function view() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/access-tickets/${id}/scope`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setData(j);
      setViewed(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { /* não chama automaticamente — exige clique consciente */ }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin/access-tickets" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-ink-50">Visualizar Access Ticket</h1>
      </div>

      {!viewed && !loading && (
        <div className="card border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-300">Esta ação será logada</h3>
              <p className="mt-2 text-sm text-ink-300">
                Você está prestes a visualizar dados pessoais de um tenant.
                Esta ação será registrada no audit log com seu ID, IP, timestamp e o que foi visto.
                <br /><br />
                Clique abaixo apenas se você tem autorização formal e registrou o motivo no ticket.
              </p>
              <button onClick={view} className="btn-primary mt-4">
                <Eye className="h-4 w-4" /> Visualizar contadores
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid place-items-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-kairos-400" />
        </div>
      )}

      {error && (
        <div className="card border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Ticket</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Motivo" value={data.ticket.reason} />
              <Row label="Autorizado por" value={data.ticket.authorizedBy || '—'} />
              <Row label="Escopo" value={data.ticket.scope} />
              <Row label="Expira" value={new Date(data.ticket.expiresAt).toLocaleString('pt-BR')} />
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Contadores (apenas números)</h2>
            <p className="mt-1 text-2xs text-ink-500">{data.complianceNote}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(data.counters).map(([k, v]) => (
                <div key={k} className="rounded bg-ink-900/40 p-3">
                  <p className="text-2xs text-ink-500">{k}</p>
                  <p className="text-2xl font-bold font-mono text-ink-100">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 text-2xs uppercase text-ink-500">{label}</dt>
      <dd className="flex-1 text-ink-200">{value}</dd>
    </div>
  );
}
