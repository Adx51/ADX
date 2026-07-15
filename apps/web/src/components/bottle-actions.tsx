'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Wine, Pencil, Trash2 } from 'lucide-react';
import { Modal, Field, inputClass } from './modal';
import { clientApi } from '@/lib/api-client';
import type { Bottle } from '@/lib/api';

export function BottleActions({ bottle }: { bottle: Bottle }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    quantity: String(bottle.quantity),
    purchasePrice: bottle.purchasePrice ?? '',
    personalRating: '',
    notes: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
      setMenu(false);
    }
  }

  async function consume() {
    if (!confirm(`Consommer une bouteille de ${bottle.wine.domain} ?`)) return;
    await run(() => clientApi.post(`/bottles/${bottle.id}/consume`, { quantity: 1 }));
  }

  async function remove() {
    if (!confirm('Supprimer définitivement cette ligne ?')) return;
    await run(() => clientApi.del(`/bottles/${bottle.id}`));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    if (form.quantity) payload.quantity = Number(form.quantity);
    if (form.purchasePrice !== '') payload.purchasePrice = Number(form.purchasePrice);
    if (form.personalRating) payload.personalRating = Number(form.personalRating);
    if (form.notes.trim()) payload.notes = form.notes.trim();
    setBusy(true);
    try {
      await clientApi.patch(`/bottles/${bottle.id}`, payload);
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex justify-end">
      <button
        onClick={() => setMenu((m) => !m)}
        aria-label="Actions"
        className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"
      >
        <MoreVertical size={16} />
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-ink-800 py-1 text-sm shadow-xl">
            <button
              onClick={consume}
              disabled={busy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/5"
            >
              <Wine size={15} className="text-bordeaux-400" /> Consommer 1
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setEditing(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/5"
            >
              <Pencil size={15} className="text-neutral-400" /> Modifier
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-400 hover:bg-white/5"
            >
              <Trash2 size={15} /> Supprimer
            </button>
          </div>
        </>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`Modifier — ${bottle.wine.domain}`}
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantité">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
              />
            </Field>
            <Field label="Prix d’achat (€)">
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => set('purchasePrice', e.target.value)}
              />
            </Field>
            <Field label="Ma note /100">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={100}
                value={form.personalRating}
                onChange={(e) => set('personalRating', e.target.value)}
                placeholder="—"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Notes">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl px-4 py-2.5 text-sm text-neutral-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-bordeaux-500 disabled:opacity-50"
            >
              {busy ? '…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
