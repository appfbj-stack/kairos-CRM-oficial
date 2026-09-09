'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Unlock, Loader2 } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  status: string;
  overdueDays: number;
  blocked: boolean;
  paymentDueDate: string | null;
  monthlyAmount: number | null;
}

export function BillingActions({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showUnblock, setShowUnblock] = useState(false);
  const [nextDue, setNextDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [amount, setAmount] = useState(tenant.monthlyAmount?.toString() || '99.90');

  async function block() {
    if (!confirm(`Bloquear "${tenant.name}" por inadimplência? Login será impedido.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/block-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ overdueDays: tenant.overdueDays }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function unblock() {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/unblock-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nextDueDate: new Date(nextDue).toISOString(),
          monthlyAmount: parseFloat(amount),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `HTTP ${res.status}`);
      }
      setShowUnblock(false);
      router.refresh();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  if (showUnblock) {
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={nextDue}
            onChange={(e) => setNextDue(e.target.value)}
            className="input text-2xs h-7 w-32"
          />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="R$"
            className="input text-2xs h-7 w-20"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={unblock}
            disabled={loading}
            className="btn-ghost text-2xs text-kairos-400 hover:bg-kairos-500/10"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
            Confirmar pgto
          </button>
          <button onClick={() => setShowUnblock(false)} className="btn-ghost text-2xs">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (tenant.blocked) {
    return (
      <button
        onClick={() => setShowUnblock(true)}
        disabled={loading}
        className="btn-ghost text-2xs text-kairos-400 hover:bg-kairos-500/10"
      >
        <Unlock className="h-3 w-3" /> Desbloquear
      </button>
    );
  }

  return (
    <button
      onClick={block}
      disabled={loading}
      className="btn-ghost text-2xs text-red-400 hover:bg-red-500/10"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
      Bloquear
    </button>
  );
}
