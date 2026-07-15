'use client';

import { useState } from 'react';

/**
 * Visual rack: a column × row grid of slots. Occupied slots are draggable and
 * can be dropped onto empty slots — the interaction the API's `POST /bottles/:id/move`
 * endpoint persists. Here it updates local state as a functional preview.
 */
export function RackGrid({
  columns,
  rows,
  filled,
}: {
  columns: number;
  rows: number;
  filled: number;
}) {
  const total = columns * rows;
  const [slots, setSlots] = useState<boolean[]>(() =>
    Array.from({ length: total }, (_, i) => i < filled),
  );
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  function onDrop(to: number) {
    if (dragFrom === null || slots[to]) return;
    setSlots((prev) => {
      const next = [...prev];
      next[dragFrom] = false;
      next[to] = true;
      return next;
    });
    setDragFrom(null);
  }

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {slots.map((occupied, i) => (
        <div
          key={i}
          draggable={occupied}
          onDragStart={() => setDragFrom(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(i)}
          title={occupied ? 'Bouteille' : 'Emplacement libre'}
          className={`aspect-square rounded-md border transition-all ${
            occupied
              ? 'cursor-grab border-bordeaux-500/40 bg-gradient-to-br from-bordeaux-600/60 to-bordeaux-900/60 hover:scale-105 active:cursor-grabbing'
              : 'border-dashed border-white/10 bg-white/[0.02] hover:border-gold-500/30'
          }`}
        />
      ))}
    </div>
  );
}
