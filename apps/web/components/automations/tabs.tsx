'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Zap, Trash2, Power, PowerOff, Copy, Clock, Calendar as CalIcon, X, Loader2, ListChecks } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  actions: any[];
  conditions: any;
  active: boolean;
  isTemplate: boolean;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  messageTemplate: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED';
  attempts: number;
  failedReason: string | null;
  sentAt: string | null;
  contact: { id: string; name: string; phone: string | null } | null;
  lead: { id: string; title: string } | null;
  assignedUser: { id: string; name: string } | null;
}

export interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'DONE' | 'CANCELLED' | 'NO_SHOW';
  notes: string | null;
  contact: { id: string; name: string; phone: string | null } | null;
  service: { id: string; name: string; durationMinutes: number; priceCents: number } | null;
}

const TRIGGER_LABEL: Record<string, string> = {
  lead_created: 'Lead criado',
  message_received: 'Mensagem recebida',
  no_response_24h: 'Sem resposta 24h',
  appointment_created: 'Agendamento criado',
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'kairos', SENT: 'ink', CANCELLED: 'red', FAILED: 'red',
  CONFIRMED: 'kairos', DONE: 'ink', NO_SHOW: 'amber',
};

export function AutomationsTabs({ initialAutomations, initialFollowUps, initialAppointments, contacts }: {
  initialAutomations: Automation[];
  initialFollowUps: FollowUp[];
  initialAppointments: Appointment[];
  contacts: { id: string; name: string; phone: string | null }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'automations' | 'followups' | 'appointments'>('automations');

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-ink-800/60">
        {[
          { k: 'automations' as const, l: 'Automações', n: initialAutomations.length, icon: Zap },
          { k: 'followups' as const, l: 'Follow-ups', n: initialFollowUps.length, icon: Clock },
          { k: 'appointments' as const, l: 'Agenda', n: initialAppointments.length, icon: CalIcon },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition ${
              tab === t.k
                ? 'border-kairos-400 text-kairos-300'
                : 'border-transparent text-ink-500 hover:text-ink-200'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.l}
            <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-2xs">{t.n}</span>
          </button>
        ))}
      </div>

      {tab === 'automations' && <AutomationsPanel initial={initialAutomations} />}
      {tab === 'followups' && <FollowUpsPanel initial={initialFollowUps} contacts={contacts} />}
      {tab === 'appointments' && <AppointmentsPanel initial={initialAppointments} contacts={contacts} />}
    </div>
  );
}

function AutomationsPanel({ initial }: { initial: Automation[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'lead_created', template: '' });

  async function install() {
    setInstalling(true);
    try {
      await apiFetch('/api/automations/install-templates', { method: 'POST' });
      const list = await apiFetch<{ data: Automation[] }>('/api/automations?limit=50');
      setItems(list.data);
      router.refresh();
    } catch (err) { alert((err as Error).message); } finally { setInstalling(false); }
  }

  async function toggle(a: Automation) {
    try {
      const u = await apiFetch<Automation>(`/api/automations/${a.id}`, { method: 'PATCH', body: { active: !a.active } });
      setItems(items.map((i) => i.id === u.id ? u : i));
    } catch (err) { alert((err as Error).message); }
  }

  async function remove(a: Automation) {
    if (!confirm(`Excluir "${a.name}"?`)) return;
    try {
      await apiFetch(`/api/automations/${a.id}`, { method: 'DELETE' });
      setItems(items.filter((i) => i.id !== a.id));
      router.refresh();
    } catch (err) { alert((err as Error).message); }
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        trigger: form.trigger,
        actions: form.template
          ? [{ type: 'send_whatsapp', params: { template: form.template } }]
          : [{ type: 'handoff_to_human', params: { reason: 'automation' } }],
        active: true,
      };
      await apiFetch('/api/automations', { method: 'POST', body });
      const list = await apiFetch<{ data: Automation[] }>('/api/automations?limit=50');
      setItems(list.data);
      setShowForm(false);
      setForm({ name: '', trigger: 'lead_created', template: '' });
      router.refresh();
    } catch (err) { alert((err as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">Regras que disparam ações automáticas quando algo acontece.</p>
        <div className="flex gap-2">
          {items.length === 0 && (
            <button onClick={install} disabled={installing} className="btn-ghost text-sm">
              {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Instalar templates prontos
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Nova automação
          </button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="card p-10 text-center">
          <Zap className="mx-auto h-12 w-12 text-ink-700" />
          <h2 className="mt-4 text-lg font-semibold text-ink-100">Nenhuma automação</h2>
          <p className="mt-1 text-sm text-ink-400">Crie do zero ou instale os templates prontos.</p>
        </div>
      )}

      {items.map((a) => (
        <div key={a.id} className={`card p-4 ${!a.active ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-3">
            <div className={`grid h-9 w-9 place-items-center rounded-lg bg-${a.active ? 'kairos' : 'ink'}-500/10`}>
              <Zap className={`h-4 w-4 text-${a.active ? 'kairos' : 'ink'}-400`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink-100">{a.name}</p>
                {a.isTemplate && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-2xs text-ink-400">template</span>}
              </div>
              <p className="text-xs text-ink-500">Quando: {TRIGGER_LABEL[a.trigger] || a.trigger}</p>
              <div className="mt-1 text-xs text-ink-400">
                {(a.actions as any[]).map((act, i) => (
                  <span key={i} className="mr-2">→ {act.type}{act.params?.template ? `: "${act.params.template.slice(0, 60)}"` : ''}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggle(a)} className="rounded p-1.5 text-ink-500 hover:bg-ink-800" title={a.active ? 'Pausar' : 'Ativar'}>
                {a.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => remove(a)} className="rounded p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">Nova automação</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Nome</label>
                <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Saudação novo lead" />
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Gatilho</label>
                <select className="input mt-1" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                  {Object.entries(TRIGGER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Mensagem (WhatsApp)</label>
                <textarea className="input mt-1 min-h-[80px]" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} placeholder="Use {{contact.name}}, {{lead.title}} como variáveis" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUpsPanel({ initial, contacts }: { initial: FollowUp[]; contacts: { id: string; name: string; phone: string | null }[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contactId: '', message: '', hours: 24 });

  async function save() {
    setSaving(true);
    try {
      const scheduledAt = new Date(Date.now() + form.hours * 3600 * 1000);
      const body: any = { messageTemplate: form.message, scheduledAt };
      if (form.contactId) body.contactId = form.contactId;
      await apiFetch('/api/followups', { method: 'POST', body });
      const list = await apiFetch<{ data: FollowUp[] }>('/api/followups?limit=50');
      setItems(list.data);
      setShowForm(false);
      setForm({ contactId: '', message: '', hours: 24 });
      router.refresh();
    } catch (err) { alert((err as Error).message); } finally { setSaving(false); }
  }

  async function cancel(f: FollowUp) {
    if (!confirm('Cancelar este follow-up?')) return;
    try {
      await apiFetch(`/api/followups/${f.id}/cancel`, { method: 'POST' });
      setItems(items.map((i) => i.id === f.id ? { ...i, status: 'CANCELLED' as const } : i));
      router.refresh();
    } catch (err) { alert((err as Error).message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">Mensagens agendadas — enviadas automaticamente pelo WhatsApp na hora marcada.</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Agendar follow-up
        </button>
      </div>

      {items.length === 0 && (
        <div className="card p-10 text-center">
          <Clock className="mx-auto h-12 w-12 text-ink-700" />
          <p className="mt-4 text-sm text-ink-400">Nenhum follow-up agendado.</p>
        </div>
      )}

      {items.map((f) => (
        <div key={f.id} className="card p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900">
              <Clock className="h-4 w-4 text-ink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-ink-100">{f.contact?.name || '—'}</p>
                <span className={`rounded px-1.5 py-0.5 text-2xs font-medium bg-${STATUS_COLOR[f.status]}-500/10 text-${STATUS_COLOR[f.status]}-400`}>
                  {f.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {f.status === 'SCHEDULED' ? `Agendado para ${new Date(f.scheduledAt).toLocaleString('pt-BR')}` :
                 f.status === 'SENT' ? `Enviado ${f.sentAt ? new Date(f.sentAt).toLocaleString('pt-BR') : ''}` :
                 f.status === 'FAILED' ? `Falhou: ${f.failedReason}` :
                 'Cancelado'}
              </p>
              <p className="mt-1 text-sm text-ink-300 line-clamp-2">{f.messageTemplate}</p>
            </div>
            {f.status === 'SCHEDULED' && (
              <button onClick={() => cancel(f)} className="rounded p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-400">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">Novo follow-up</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Contato</label>
                <select className="input mt-1" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
                  <option value="">— escolha —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Mensagem</label>
                <textarea className="input mt-1 min-h-[80px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Enviar em (horas)</label>
                <input type="number" min={1} max={720} className="input mt-1" value={form.hours} onChange={(e) => setForm({ ...form, hours: parseInt(e.target.value) || 24 })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.contactId || !form.message} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentsPanel({ initial, contacts }: { initial: Appointment[]; contacts: { id: string; name: string; phone: string | null }[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contactId: '', startTime: '', duration: 60, notes: '' });

  async function save() {
    setSaving(true);
    try {
      const start = new Date(form.startTime);
      const end = new Date(start.getTime() + form.duration * 60 * 1000);
      const body: any = { contactId: form.contactId, startTime: start, endTime: end, notes: form.notes || undefined };
      await apiFetch('/api/appointments', { method: 'POST', body });
      const list = await apiFetch<{ data: Appointment[] }>('/api/appointments?limit=50');
      setItems(list.data);
      setShowForm(false);
      setForm({ contactId: '', startTime: '', duration: 60, notes: '' });
      router.refresh();
    } catch (err) { alert((err as Error).message); } finally { setSaving(false); }
  }

  async function cancel(a: Appointment) {
    if (!confirm('Cancelar este agendamento?')) return;
    try {
      await apiFetch(`/api/appointments/${a.id}/cancel`, { method: 'POST', body: {} });
      setItems(items.map((i) => i.id === a.id ? { ...i, status: 'CANCELLED' as const } : i));
      router.refresh();
    } catch (err) { alert((err as Error).message); }
  }

  async function setStatus(a: Appointment, status: Appointment['status']) {
    try {
      const u = await apiFetch<Appointment>(`/api/appointments/${a.id}`, { method: 'PATCH', body: { status } });
      setItems(items.map((i) => i.id === a.id ? u : i));
    } catch (err) { alert((err as Error).message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">Compromissos com clientes. Podem ser criados pela Kairos IA ou manualmente.</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Novo agendamento
        </button>
      </div>

      {items.length === 0 && (
        <div className="card p-10 text-center">
          <CalIcon className="mx-auto h-12 w-12 text-ink-700" />
          <p className="mt-4 text-sm text-ink-400">Agenda vazia.</p>
        </div>
      )}

      {items.map((a) => (
        <div key={a.id} className="card p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900">
              <CalIcon className="h-4 w-4 text-ink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink-100">{a.contact?.name || '—'}</p>
                <span className={`rounded px-1.5 py-0.5 text-2xs font-medium bg-${STATUS_COLOR[a.status]}-500/10 text-${STATUS_COLOR[a.status]}-400`}>
                  {a.status}
                </span>
              </div>
              <p className="text-xs text-ink-500">{new Date(a.startTime).toLocaleString('pt-BR')} → {new Date(a.endTime).toLocaleTimeString('pt-BR')}</p>
              {a.service && <p className="text-xs text-ink-400">Serviço: {a.service.name}</p>}
              {a.notes && <p className="mt-1 text-sm text-ink-300">{a.notes}</p>}
            </div>
            {a.status === 'SCHEDULED' && (
              <div className="flex gap-1">
                <button onClick={() => setStatus(a, 'CONFIRMED')} className="rounded p-1.5 text-ink-500 hover:bg-kairos-500/10 hover:text-kairos-400" title="Confirmar">
                  <ListChecks className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => cancel(a)} className="rounded p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {a.status === 'CONFIRMED' && (
              <button onClick={() => setStatus(a, 'DONE')} className="rounded p-1.5 text-ink-500 hover:bg-kairos-500/10 hover:text-kairos-400" title="Marcar como feito">
                <ListChecks className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">Novo agendamento</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Contato</label>
                <select className="input mt-1" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
                  <option value="">— escolha —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-500">Início</label>
                  <input type="datetime-local" className="input mt-1" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-500">Duração (min)</label>
                  <input type="number" min={5} className="input mt-1" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })} />
                </div>
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Notas</label>
                <textarea className="input mt-1 min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.contactId || !form.startTime} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
