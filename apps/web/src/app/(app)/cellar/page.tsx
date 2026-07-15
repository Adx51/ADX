import { Card } from '@/components/ui';
import { RackGrid } from '@/components/rack-grid';

// Demo cellar structure mirroring the Zone → Rack → Position model.
const DEMO_ZONES = [
  {
    name: 'Mur A',
    racks: [
      { name: 'Casier A1', columns: 6, rows: 5, filled: 22 },
      { name: 'Casier A2', columns: 6, rows: 5, filled: 18 },
    ],
  },
  {
    name: 'Mur B',
    racks: [{ name: 'Casier B1', columns: 8, rows: 4, filled: 27 }],
  },
];

export default function CellarPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-white">Ma cave</h1>
        <p className="text-sm text-neutral-500">
          Représentation physique — glisser-déposer pour réorganiser
        </p>
      </header>

      {DEMO_ZONES.map((zone) => (
        <section key={zone.name} className="space-y-3">
          <h2 className="font-display text-lg font-medium text-neutral-300">
            {zone.name}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {zone.racks.map((rack) => (
              <Card key={rack.name}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-200">
                    {rack.name}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {rack.filled}/{rack.columns * rack.rows} emplacements
                  </span>
                </div>
                <RackGrid
                  columns={rack.columns}
                  rows={rack.rows}
                  filled={rack.filled}
                />
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
