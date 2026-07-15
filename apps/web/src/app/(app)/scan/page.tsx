import { Card } from '@/components/ui';
import { ScanLine, Package, ReceiptText } from 'lucide-react';

const MODES = [
  {
    icon: ScanLine,
    title: 'Scanner une bouteille',
    desc: 'L’IA reconnaît le domaine, le millésime, la cuvée et l’appellation à partir de l’étiquette.',
    endpoint: 'POST /api/ai/scan/bottle',
  },
  {
    icon: Package,
    title: 'Scanner une caisse',
    desc: 'Reconnaissance multiple : chaque bouteille d’une caisse est identifiée en une seule photo.',
    endpoint: 'POST /api/ai/scan/case',
  },
  {
    icon: ReceiptText,
    title: 'Scanner une facture',
    desc: 'Extraction automatique du vendeur, de la date et de chaque ligne (bouteille, quantité, prix).',
    endpoint: 'POST /api/ai/scan/invoice',
  },
];

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-white">Scanner IA</h1>
        <p className="text-sm text-neutral-500">
          Vision AI — ajoutez des bouteilles sans saisie manuelle
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map(({ icon: Icon, title, desc, endpoint }) => (
          <Card key={title} className="flex flex-col gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-bordeaux-500 to-bordeaux-700">
              <Icon size={20} className="text-gold-400" />
            </span>
            <h2 className="font-display text-lg font-medium text-white">{title}</h2>
            <p className="flex-1 text-sm text-neutral-400">{desc}</p>
            <code className="rounded-lg bg-black/30 px-2 py-1 text-[11px] text-neutral-500">
              {endpoint}
            </code>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <ScanLine size={32} className="text-neutral-600" />
          <p className="text-sm text-neutral-400">
            Déposez une photo ou activez la caméra pour commencer
          </p>
          <p className="max-w-md text-xs text-neutral-600">
            Le flux d’upload (Supabase / S3) puis l’appel Vision AI est prévu par
            l’architecture. Les endpoints ci-dessus sont déjà exposés par l’API.
          </p>
        </div>
      </Card>
    </div>
  );
}
