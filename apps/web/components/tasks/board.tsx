'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, User as UserIcon, Pencil, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'TODO' | 'DOING' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  assignedUser: { id: string; name: string; avatarUrl: string | null } | null;
  lead: { id: string; title: string } | null;
  contact: { id: string; name: string } | null;
}

const COLUMNS: { status: Task['status']; label: string; color: string; icon: any }[] = [
  { status: 'TODO', label: 'A fazer', color: 'ink', icon: Circle },
  { status: 'DOING', label: 'Em andamento', color: 'amber', icon: Clock },
  { status: 'DONE', label: 'Concluídas', color: 'kairos', icon: CheckCircle2 },
];

const priorityColors: Record<string, string> = {
  LOW: 'bg-ink-700 text-ink-300',
  MEDIUM: 'bg-blue-500/10 text-blue-400',
  HIGH: 'bg-amber-500/10 text-amber-400',
  URGENT: 'bg-red-500/10 text-red-400',
};

export function TasksBoard({ initial }: { initial: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM' as Task['priority'] });
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM' });
    setShowForm(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || '',
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
      priority: t.priority,
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      };
      if (editing) {
        const updated = await apiFetch<Task>(`/api/crm/tasks/${editing.id}`, { method: 'PATCH', body });
        setTasks(tasks.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
      } else {
        const created = await apiFetch<Task>('/api/crm/tasks', { method: 'POST', body });
        setTasks([created, ...tasks]);
      }
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function moveStatus(t: Task, status: Task['status']) {
    try {
      const updated = await apiFetch<Task>(`/api/crm/tasks/${t.id}`, { method: 'PATCH', body: { status } });
      setTasks(tasks.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(t: Task) {
    if (!confirm(`Excluir "${t.title}"?`)) return;
    try {
      await apiFetch(`/api/crm/tasks/${t.id}`, { method: 'DELETE' });
      setTasks(tasks.filter((i) => i.id !== t.id));
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">{tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} no total.</p>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <col.icon className={`h-4 w-4 text-${col.color}-400`} />
                  <h3 className="text-sm font-semibold text-ink-100">{col.label}</h3>
                  <span className="rounded-full bg-ink-800 px-2 py-0.5 text-2xs font-medium text-ink-400">{list.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {list.length === 0 && <p className="py-4 text-center text-xs text-ink-600">Vazio.</p>}
                {list.map((t) => (
                  <div key={t.id} className="rounded-lg border border-ink-800/60 bg-ink-900/40 p-3 hover:border-ink-700">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-100">{t.title}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <button onClick={() => openEdit(t)} className="rounded p-1 text-ink-500 hover:bg-ink-800 hover:text-ink-200"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => remove(t)} className="rounded p-1 text-ink-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                    {t.description && <p className="mt-1 text-xs text-ink-400 line-clamp-2">{t.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${priorityColors[t.priority]}`}>{t.priority}</span>
                      {t.dueDate && (
                        <span className="flex items-center gap-1 text-2xs text-ink-500"><Calendar className="h-3 w-3" />{new Date(t.dueDate).toLocaleDateString('pt-BR')}</span>
                      )}
                      {t.assignedUser && (
                        <span className="flex items-center gap-1 text-2xs text-ink-500"><UserIcon className="h-3 w-3" />{t.assignedUser.name.split(' ')[0]}</span>
                      )}
                    </div>
                    {t.lead && <p className="mt-1.5 text-2xs text-kairos-400">→ {t.lead.title}</p>}
                    <div className="mt-2 flex gap-1 border-t border-ink-800/40 pt-2">
                      {COLUMNS.filter((c) => c.status !== t.status).map((c) => (
                        <button key={c.status} onClick={() => moveStatus(t, c.status)} className="rounded px-1.5 py-0.5 text-2xs text-ink-500 hover:bg-ink-800 hover:text-ink-200">
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">{editing ? 'Editar' : 'Nova'} tarefa</h2>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea className="input min-h-[80px]" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.title.trim()} className="btn-primary">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
