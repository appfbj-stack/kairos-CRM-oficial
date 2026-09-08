'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Search, Tag as TagIcon, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string | null;
  active: boolean;
  durationMinutes?: number;
  _count?: { appointments: number };
}

interface Props {
  kind: 'product' | 'service';
  initial: CatalogItem[];
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function CatalogTable({ kind, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: '', duration: '60', active: true,
  });
  const [saving, setSaving] = useState(false);

  const basePath = kind === 'product' ? '/api/crm/products' : '/api/crm/services';

  const filtered = items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: '', duration: '60', active: true });
    setShowForm(true);
  }

  function openEdit(i: CatalogItem) {
    setEditing(i);
    setForm({
      name: i.name,
      description: i.description || '',
      price: (i.priceCents / 100).toFixed(2),
      category: i.category || '',
      duration: (i.durationMinutes || 60).toString(),
      active: i.active,
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(form.price.replace(',', '.')) * 100);
      if (isNaN(priceCents) || priceCents < 0) throw new Error('Preço inválido');
      const body: any = {
        name: form.name,
        description: form.description || undefined,
        priceCents,
        category: form.category || undefined,
        active: form.active,
      };
      if (kind === 'service') body.durationMinutes = parseInt(form.duration) || 60;

      if (editing) {
        const updated = await apiFetch<CatalogItem>(`${basePath}/${editing.id}`, { method: 'PATCH', body });
        setItems(items.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
      } else {
        const created = await apiFetch<CatalogItem>(basePath, { method: 'POST', body });
        setItems([{ ...created, _count: { appointments: 0 } }, ...items]);
      }
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(i: CatalogItem) {
    if (!confirm(`Excluir "${i.name}"?`)) return;
    try {
      await apiFetch(`${basePath}/${i.id}`, { method: 'DELETE' });
      setItems(items.filter((x) => x.id !== i.id));
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${kind === 'product' ? 'produtos' : 'serviços'}…`}
            className="input pl-10"
          />
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> {kind === 'product' ? 'Novo produto' : 'Novo serviço'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800/60 bg-ink-900/40 text-left text-2xs font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-right">Preço</th>
              {kind === 'service' && <th className="px-4 py-3 text-center">Duração</th>}
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-500">Nenhum item encontrado.</td></tr>
            )}
            {filtered.map((i) => (
              <tr key={i.id} className="border-b border-ink-800/40 last:border-0 hover:bg-ink-900/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-100">{i.name}</div>
                  {i.description && <div className="text-xs text-ink-500 line-clamp-1">{i.description}</div>}
                </td>
                <td className="px-4 py-3 text-ink-400">
                  {i.category && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-2xs text-ink-300"><TagIcon className="inline h-2.5 w-2.5" /> {i.category}</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink-200">{formatBRL(i.priceCents)}</td>
                {kind === 'service' && (
                  <td className="px-4 py-3 text-center text-xs text-ink-400">
                    <Clock className="inline h-3 w-3" /> {i.durationMinutes}min
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${i.active ? 'bg-kairos-500/10 text-kairos-400' : 'bg-ink-800 text-ink-500'}`}>
                    {i.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(i)} className="rounded p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(i)} className="rounded p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink-50">{editing ? 'Editar' : 'Novo'} {kind === 'product' ? 'produto' : 'serviço'}</h2>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="input min-h-[60px]" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Preço (R$) *" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <input className="input" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              {kind === 'service' && (
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="number" placeholder="Duração (min)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    Ativo
                  </label>
                </div>
              )}
              {kind === 'product' && (
                <label className="flex items-center gap-2 text-sm text-ink-300">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Ativo
                </label>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.price} className="btn-primary">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
