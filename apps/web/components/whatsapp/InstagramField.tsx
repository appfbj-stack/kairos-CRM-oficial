'use client';

import { useEffect, useState } from 'react';
import { Instagram, ExternalLink, Check, X } from 'lucide-react';

const STORAGE_KEY = 'kairos_instagram_handle';

export function InstagramField() {
  const [handle, setHandle] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      const h = window.localStorage.getItem(STORAGE_KEY);
      if (h) {
        setHandle(h);
        setSaved(h);
      }
    } catch {}
  }, []);

  function save() {
    const clean = draft.replace(/^@/, '').trim();
    try {
      if (clean) {
        window.localStorage.setItem(STORAGE_KEY, clean);
        setHandle(clean);
        setSaved(clean);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        setHandle('');
        setSaved(null);
      }
    } catch {}
    setEditing(false);
  }

  function open() {
    const url = handle ? `https://www.instagram.com/${handle}/` : 'https://www.instagram.com/';
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-pink-500/10 text-pink-400">
            <Instagram className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink-100">Instagram</h3>
            <p className="text-2xs text-ink-500">
              {saved
                ? `Conta configurada: @${saved}`
                : 'Configure seu @ e abra o Instagram direto daqui.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={save} className="btn-ghost text-2xs">
                <Check className="h-3 w-3 text-kairos-400" /> Salvar
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(handle); }}
                className="btn-ghost text-2xs"
              >
                <X className="h-3 w-3" /> Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => { setDraft(handle); setEditing(true); }}
              className="btn-ghost text-2xs"
            >
              {saved ? 'Editar' : 'Configurar'}
            </button>
          )}
          <button onClick={open} className="btn-primary text-2xs">
            <ExternalLink className="h-3 w-3" /> Abrir Instagram
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-ink-500">instagram.com/</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="seuarroba"
            className="input flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
        </div>
      )}

      <p className="mt-3 text-2xs text-ink-600">
        O Instagram abre em nova aba usando a conta que já tá logada no seu navegador. Salvo no seu navegador (localStorage).
      </p>
    </div>
  );
}
