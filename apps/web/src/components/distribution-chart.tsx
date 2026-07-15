'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from 'recharts';
import type { Distribution } from '@/lib/api';

const COLOR_HEX: Record<string, string> = {
  RED: '#a03050',
  WHITE: '#e9c46a',
  ROSE: '#e78fa5',
  ORANGE: '#e08a3c',
  UNKNOWN: '#555',
};

const REGION_PALETTE = [
  '#a03050',
  '#7d1f3d',
  '#d4a437',
  '#c05a72',
  '#8a6d3b',
  '#5e1730',
  '#b8860b',
];

export function DistributionChart({ distribution }: { distribution: Distribution }) {
  const colorData = Object.entries(distribution.byColor).map(([name, value]) => ({
    name,
    value,
  }));
  const regionData = Object.entries(distribution.byRegion)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
          Par couleur
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={colorData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
            >
              {colorData.map((d) => (
                <Cell key={d.name} fill={COLOR_HEX[d.name] ?? '#555'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1a1a1f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#fff',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
          Par région
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={regionData} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" hide />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {regionData.map((d, i) => (
                <Cell key={d.name} fill={REGION_PALETTE[i % REGION_PALETTE.length]} />
              ))}
            </Bar>
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#1a1a1f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#fff',
              }}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-400">
          {regionData.map((d, i) => (
            <span key={d.name} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: REGION_PALETTE[i % REGION_PALETTE.length] }}
              />
              {d.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
