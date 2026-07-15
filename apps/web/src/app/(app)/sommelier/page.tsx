'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api-client';
import type { SommelierAnswer } from '@/lib/api';
import { Sparkles, Send } from 'lucide-react';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Que boire ce soir avec une côte de bœuf ?',
  'Quel est mon meilleur Bordeaux ?',
  'Quels vins dois-je boire avant 2028 ?',
  'Prépare une dégustation de 6 vins.',
];

export default function SommelierPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await clientApi.post<SommelierAnswer>('/ai/sommelier', { question: q });
      setTurns((t) => [...t, { role: 'assistant', content: res.answer }]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          content:
            'Le service sommelier est indisponible. Vérifiez que l’API tourne et qu’une clé OpenAI est configurée.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-bordeaux-500 to-bordeaux-700">
          <Sparkles size={20} className="text-gold-400" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Sommelier IA
          </h1>
          <p className="text-sm text-neutral-500">
            Votre expert personnel, à l’écoute de votre cave
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {turns.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="glass rounded-xl px-4 py-3 text-left text-sm text-neutral-300 transition-colors hover:bg-white/[0.06]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) => (
          <div
            key={i}
            className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                t.role === 'user'
                  ? 'bg-bordeaux-600 text-white'
                  : 'glass text-neutral-200'
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl px-4 py-3 text-sm text-neutral-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">Le sommelier réfléchit</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="glass mt-2 flex items-center gap-2 rounded-2xl p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question au sommelier…"
          className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-bordeaux-600 text-white transition-colors hover:bg-bordeaux-500 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
