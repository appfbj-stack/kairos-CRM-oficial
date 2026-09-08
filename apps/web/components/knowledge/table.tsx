'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, BookOpen, X, Loader2, Tag, Power, PowerOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface Knowledge {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  source: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function KnowledgeTable({ initial }: { initial: Knowledge[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Knowledge | null>(null);
  const [form, setForm] = useState({ question: '', answer: '', category: '' });
  const [saving, setSaving] = useState(false);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]));

  const filtered = items.filter((i) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm({ question: '', answer: '', category: '' });
    setShowForm(true);
  }

  function openEdit(k: Knowledge) {
    setEditing(k);
    setForm({ question: k.question, answer: k.answer, category: k.category || '' });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        question: form.question,
        answer: form.answer,
        category: form.category || undefined,
        active: editing?.active ?? true,
      };
      if (editing) {
        const updated = await apiFetch<Knowledge>(`/api/knowledge/${editing.id}`, { method: 'PATCH', body });
        setItems(items.map((i) => i.id === updated.id ? updated : i));
      } else {
        const created = await apiFetch<Knowledge>('/api/knowledge', { method: 'POST', body });
        setItems([created, ...items]);
      }
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(k: Knowledge) {
    try {
      const updated = await apiFetch<Knowledge>(`/api/knowledge/${k.id}`, {
        method: 'PATCH', body: { active: !k.active },
      });
      setItems(items.map((i) => i.id === updated.id ? updated : i));
    } catch (err) { alert((err as Error).message); }
  }

  async function remove(k: Knowledge) {
    if (!confirm(`Excluir "${k.question.slice(0, 60)}"?`)) return;
    try {
      await apiFetch(`/api/knowledge/${k.id}`, { method: 'DELETE' });
      setItems(items.filter((i) => i.id !== k.id));
      router.refresh();
    } catch (err) { alert((err as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar perguntas e respostas…"
            className="input pl-10"
          />
        </div>
        {categories.length > 0 && (
          <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Todas categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> Nova entrada
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-ink-700" />
          <h2 className="mt-4 text-lg font-semibold text-ink-100">Base vazia</h2>
          <p className="mt-1 text-sm text-ink-400">Adicione perguntas frequentes pra Kairos IA usar como fonte de verdade.</p>
          <button onClick={openCreate} className="btn-primary mt-4">
            <Plus className="h-4 w-4" /> Adicionar primeira entrada
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((k) => (
            <div key={k.id} className={`card p-4 ${!k.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-100">{k.question}</p>
                    {!k.active && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-2xs text-ink-500">inativa</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-300 whitespace-pre-wrap">{k.answer}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-ink-500">
                    {k.category && (
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {k.category}</span>
                    )}
                    <span>Atualizado {new Date(k.updatedAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => toggleActive(k)} className="rounded p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-200" title={k.active ? 'Desativar' : 'Ativar'}>
                    {k.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => openEdit(k)} className="rounded p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-200">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(k)} className="rounded p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-50">{editing ? 'Editar' : 'Nova'} entrada</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 text-ink-500 hover:text-ink-200"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-sm text-ink-400">
              A Kairos IA vai usar estas Q&amp;A pra responder perguntas dos clientes no WhatsApp.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Pergunta *</label>
                <input
                  className="input mt-1"
                  placeholder="Ex: Qual o horário de funcionamento?"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                />
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Resposta *</label>
                <textarea
                  className="input mt-1 min-h-[120px]"
                  placeholder="Ex: Seg-Sex das 9h às 18h. Sáb das 9h às 13h."
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                />
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-500">Categoria (opcional)</label>
                <input
                  className="input mt-1"
                  placeholder="horário, política, produto, FAQ…"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.question.trim() || !form.answer.trim()} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
