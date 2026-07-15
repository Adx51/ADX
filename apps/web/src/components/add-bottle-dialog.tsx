'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import { Modal, Field, inputClass } from './modal';
import { clientApi } from '@/lib/api-client';
import type { Cellar } from '@/lib/api';

const EMPTY = {
  domain: '',
  cuvee: '',
  vintage: '',
  region: '',
  country: '',
  appellation: '',
  quantity: '1',
  purchasePrice: '',
  purchaseDate: '',
  purchasePlace: '',
  notes: '',
};

export function AddBottleDialog({ cellars }: { cellars: Cellar[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cellarId, setCellarId] = useState(cellars[0]?.id ?? '');
  const [f, setF] = useState(EMPTY);

  const set = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.domain.trim()) {
      setError('Le domaine est requis.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Existing accounts created before default cellars won't have one yet.
      let targetCellar = cellarId;
      if (!targetCellar) {
        const c = await clientApi.post<{ id: string }>('/cellars', { name: 'Ma cave' });
        targetCellar = c.id;
      }

      const payload: Record<string, unknown> = {
        cellarId: targetCellar,
        domain: f.domain.trim(),
      };
      if (f.cuvee.trim()) payload.cuvee = f.cuvee.trim();
      if (f.vintage) payload.vintage = Number(f.vintage);
      if (f.region.trim()) payload.region = f.region.trim();
      if (f.country.trim()) payload.country = f.country.trim();
      if (f.appellation.trim()) payload.appellation = f.appellation.trim();
      if (f.quantity) payload.quantity = Number(f.quantity);
      if (f.purchasePrice) payload.purchasePrice = Number(f.purchasePrice);
      if (f.purchaseDate) payload.purchaseDate = f.purchaseDate;
      if (f.purchasePlace.trim()) payload.purchasePlace = f.purchasePlace.trim();
      if (f.notes.trim()) payload.notes = f.notes.trim();

      await clientApi.post('/bottles', payload);
      setF(EMPTY);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Échec de l’ajout. Vérifiez la connexion à l’API et réessayez.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-bordeaux-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-bordeaux-500"
      >
        <Plus size={16} /> Ajouter
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter une bouteille">
        <form onSubmit={submit} className="space-y-4">
          <p className="flex items-center gap-1.5 rounded-lg bg-gold-500/10 px-3 py-2 text-xs text-gold-400">
            <Sparkles size={13} /> L’IA complète automatiquement cépages, garde,
            accords et valeur estimée.
          </p>

          {cellars.length > 1 && (
            <Field label="Cave">
              <select
                value={cellarId}
                onChange={(e) => setCellarId(e.target.value)}
                className={inputClass}
              >
                {cellars.map((c) => (
                  <option key={c.id} value={c.id} className="bg-ink-800">
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Domaine *">
                <input
                  className={inputClass}
                  value={f.domain}
                  onChange={(e) => set('domain', e.target.value)}
                  placeholder="Château Margaux"
                  autoFocus
                />
              </Field>
            </div>
            <Field label="Cuvée">
              <input
                className={inputClass}
                value={f.cuvee}
                onChange={(e) => set('cuvee', e.target.value)}
                placeholder="Grand Vin"
              />
            </Field>
            <Field label="Millésime">
              <input
                className={inputClass}
                type="number"
                value={f.vintage}
                onChange={(e) => set('vintage', e.target.value)}
                placeholder="2015"
              />
            </Field>
            <Field label="Région">
              <input
                className={inputClass}
                value={f.region}
                onChange={(e) => set('region', e.target.value)}
                placeholder="Bordeaux"
              />
            </Field>
            <Field label="Pays">
              <input
                className={inputClass}
                value={f.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="France"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Appellation">
                <input
                  className={inputClass}
                  value={f.appellation}
                  onChange={(e) => set('appellation', e.target.value)}
                  placeholder="Margaux"
                />
              </Field>
            </div>
            <Field label="Quantité">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={f.quantity}
                onChange={(e) => set('quantity', e.target.value)}
              />
            </Field>
            <Field label="Prix d’achat (€)">
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={f.purchasePrice}
                onChange={(e) => set('purchasePrice', e.target.value)}
                placeholder="550"
              />
            </Field>
            <Field label="Date d’achat">
              <input
                className={inputClass}
                type="date"
                value={f.purchaseDate}
                onChange={(e) => set('purchaseDate', e.target.value)}
              />
            </Field>
            <Field label="Lieu d’achat">
              <input
                className={inputClass}
                value={f.purchasePlace}
                onChange={(e) => set('purchasePlace', e.target.value)}
                placeholder="iDealwine"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Notes">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={f.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm text-neutral-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-bordeaux-500 disabled:opacity-50"
            >
              {saving ? 'Ajout…' : 'Ajouter la bouteille'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
