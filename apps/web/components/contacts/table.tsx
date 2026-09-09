'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Pencil, Trash2, Phone, Mail, Tag as TagIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  tags: string[];
  notes: string | null;
  source: string | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  _count: { leads: number; conversations: number };
}

export function ContactsTable({ initial }: { initial: Contact[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', tags: '' });
  const [saving, setSaving] = useState(false);

  const filtered = items.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', notes: '', tags: '' });
    setShowForm(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone || '', email: c.email || '',
      notes: c.notes || '', tags: c.tags.join(', '),
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (editing) {
        const updated = await apiFetch<Contact>(`/api/crm/contacts/${editing.id}`, {
          method: 'PATCH', body,
        });
        setItems(items.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
      } else {
        const created = await apiFetch<Contact>('/api/crm/contacts', {
          method: 'POST', body,
        });
        setItems([{ ...created, company: null, _count: { leads: 0, conversations: 0 } }, ...items]);
      }
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Contact) {
    if (!confirm(`Excluir ${c.name}?`)) return;
    try {
      await apiFetch(`/api/crm/contacts/${c.id}`, { method: 'DELETE' });
      setItems(items.filter((i) => i.id !== c.id));
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
            placeholder="Buscar por nome, telefone, email…"
            className="input pl-10"
          />
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> Novo contato
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800/60 bg-ink-900/40 text-left text-2xs font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3 text-center">Leads</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-500">Nenhum contato encontrado.</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-ink-800/40 last:border-0 hover:bg-ink-900/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-100">{c.name}</div>
                  {c.company && <div className="text-xs text-ink-500">{c.company.name}</div>}
                </td>
                <td className="px-4 py-3 text-ink-400">
                  {c.phone && <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3" />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3" />{c.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-2xs text-ink-300"><TagIcon className="inline h-2.5 w-2.5" /> {t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-ink-300">{c._count.leads}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="rounded p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(c)} className="rounded p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
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
            <h2 className="text-lg font-semibold text-ink-50">{editing ? 'Editar' : 'Novo'} contato</h2>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="Tags (separadas por vírgula)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <textarea className="input min-h-[80px]" placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
