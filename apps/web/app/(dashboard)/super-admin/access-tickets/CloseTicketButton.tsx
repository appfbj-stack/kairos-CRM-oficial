'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function close() {
    if (!confirm('Fechar este Access Ticket? O acesso aos dados será revogado.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/access-tickets/${ticketId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={close} disabled={loading} className="btn-ghost text-2xs text-red-400 hover:bg-red-500/10">
      <Lock className="h-3 w-3" /> {loading ? 'Fechando…' : 'Fechar'}
    </button>
  );
}
