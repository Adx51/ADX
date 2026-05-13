import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Award, Lock, BarChart2 } from 'lucide-react'
import { api } from '../../lib/api'
import { caToDisplayHa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'

// Courbe Catmull-Rom → chemin SVG lisse
function catmullRom(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = i < pts.length - 2 ? pts[i + 2] : pts[i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function fmtK(v) {
  if (v == null) return '—'
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  if (v >= 1000)  return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

// Agrégation par commune pressoir
function aggregateByCommune(vendanges) {
  const map = {}
  for (const v of vendanges) {
    const key = v.commune_pressoir || 'Non défini'
    if (!map[key]) map[key] = { name: key, poids: 0, surface: 0 }
    map[key].poids   += v.poids_total      || 0
    map[key].surface += v.surface_totale_ca || 0
  }
  return Object.values(map)
    .map(g => ({ ...g, kgha: g.surface > 0 ? Math.round(g.poids / (g.surface / 10000)) : null }))
    .sort((a, b) => (b.poids || 0) - (a.poids || 0))
}

// Agrégation par cépage (split équitable si plusieurs cépages sur la parcelle)
function aggregateByCepage(vendanges) {
  const map = {}
  for (const v of vendanges) {
    const cepages = v.cepages?.length > 0 ? v.cepages : ['Non précisé']
    const share = 1 / cepages.length
    for (const c of cepages) {
      if (!map[c]) map[c] = { name: c, poids: 0, surface: 0 }
      map[c].poids   += (v.poids_total      || 0) * share
      map[c].surface += (v.surface_totale_ca || 0) * share
    }
  }
  return Object.values(map)
    .map(g => ({ ...g, kgha: g.surface > 0 ? Math.round(g.poids / (g.surface / 10000)) : null }))
    .sort((a, b) => (b.poids || 0) - (a.poids || 0))
}

// ── Graphe area chart : rendement kg/ha ──────────────────────────────────────
function RendementChart({ data }) {
  const W = 320, H = 140
  const PAD = { top: 28, right: 14, bottom: 28, left: 14 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const active = data.filter(d => d.rendement_kgha > 0)
  if (active.length < 2) return (
    <p className="text-sm text-gray-400 text-center py-6">Au moins 2 campagnes requises</p>
  )

  const vals      = active.map(d => d.rendement_kgha)
  const attenduV  = active.map(d => d.rendement_attendu_kgha || 0)
  const maxY      = Math.max(...vals, ...attenduV) * 1.2

  const n    = active.length
  const xPos = i => PAD.left + (n > 1 ? i * CW / (n - 1) : CW / 2)
  const yPos = v => PAD.top + CH - (v / maxY) * CH

  const pts      = active.map((d, i) => ({ x: xPos(i), y: yPos(d.rendement_kgha), val: d.rendement_kgha, annee: d.annee }))
  const linePath = catmullRom(pts)
  const areaPath = `${linePath} L ${pts[pts.length-1].x.toFixed(1)},${PAD.top+CH} L ${pts[0].x.toFixed(1)},${PAD.top+CH} Z`

  const attenduPts  = active.map((d, i) => d.rendement_attendu_kgha ? { x: xPos(i), y: yPos(d.rendement_attendu_kgha) } : null).filter(Boolean)
  const attenduPath = attenduPts.length >= 2 ? catmullRom(attenduPts) : null
  const midVal      = Math.round(Math.max(...vals) / 2)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="rdt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d97706" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[midVal, Math.max(...vals)].map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={yPos(v)} x2={W-PAD.right} y2={yPos(v)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={PAD.left+2} y={yPos(v)-3} fontSize="8" fill="#e5e7eb">{fmtK(v)}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#rdt-grad)" />
      {attenduPath && <path d={attenduPath} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5,3" strokeLinecap="round" />}
      <path d={linePath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(p => (
        <g key={p.annee}>
          <circle cx={p.x} cy={p.y} r="4.5" fill="white" stroke="#d97706" strokeWidth="2.5" />
          <text x={p.x} y={p.y-9} textAnchor="middle" fontSize="9.5" fill="#92400e" fontWeight="700">{fmtK(p.val)}</text>
        </g>
      ))}
      {active.map((d, i) => (
        <text key={d.annee} x={xPos(i)} y={H-7} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.annee}</text>
      ))}
    </svg>
  )
}

// ── Graphe barres : production totale kg ─────────────────────────────────────
function ProductionChart({ data }) {
  const W = 320, H = 130
  const PAD = { top: 24, right: 14, bottom: 26, left: 14 }
  const CW  = W - PAD.left - PAD.right
  const CH  = H - PAD.top  - PAD.bottom

  const active  = data.filter(d => d.poids_total > 0)
  if (active.length < 1) return null

  const vals    = active.map(d => d.poids_total)
  const maxY    = Math.max(...vals) * 1.2
  const bestVal = Math.max(...vals)
  const n       = active.length
  const xStep   = CW / n
  const barW    = Math.min(xStep * 0.6, 40)
  const xCenter = i => PAD.left + i * xStep + xStep / 2
  const yPos    = v => PAD.top + CH - (v / maxY) * CH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="prod-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#15803d" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#15803d" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {active.map((d, i) => {
        const bh    = (d.poids_total / maxY) * CH
        const x     = xCenter(i) - barW / 2
        const y     = yPos(d.poids_total)
        const isBest = d.poids_total === bestVal
        return (
          <g key={d.annee}>
            <rect x={x} y={y} width={barW} height={bh} rx="5" fill={isBest ? '#15803d' : 'url(#prod-grad)'} />
            <text x={xCenter(i)} y={y-5} textAnchor="middle" fontSize="9.5" fill="#14532d" fontWeight={isBest ? '700' : '600'}>{fmtK(d.poids_total)}</text>
            <text x={xCenter(i)} y={H-7} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.annee}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Barres horizontales de répartition ───────────────────────────────────────
function BreakdownList({ items }) {
  if (!items.length) return <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>
  const maxPoids = Math.max(...items.map(i => i.poids || 0), 1)
  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.name}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-semibold text-gray-800 truncate flex-1 mr-3">{item.name}</span>
            <span className="text-sm font-bold text-gray-900 flex-shrink-0 tabular-nums">
              {item.kgha ? `${item.kgha.toLocaleString('fr-FR')} kg/ha` : '—'}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${Math.round((item.poids / maxPoids) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {Math.round(item.poids).toLocaleString('fr-FR')} kg
            {item.surface > 100 && ` · ${caToDisplayHa(Math.round(item.surface))}`}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function StatsGlobales() {
  const navigate       = useNavigate()
  const [stats, setStats]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [selectedYear, setSelectedYear] = useState(null) // null = toutes
  const [tab, setTab]                 = useState('commune')

  useEffect(() => {
    api.get('/campagnes/stats').then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div>
      <PageHeader title="Statistiques" back="/vendange" />
      <div className="px-4 pt-4 space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="rounded-3xl skeleton h-40" />)}
      </div>
    </div>
  )

  if (!stats || stats.campagnes.length === 0) return (
    <div>
      <PageHeader title="Statistiques" back="/vendange" />
      <div className="flex flex-col items-center justify-center py-20 text-center px-8">
        <BarChart2 size={48} className="text-vigne-200 mb-4" />
        <p className="text-gray-500 font-medium">Aucune donnée disponible</p>
        <p className="text-sm text-gray-400 mt-1">Créez des campagnes pour voir vos statistiques</p>
      </div>
    </div>
  )

  const { surface_totale_ca, campagnes, vendangesDetail = [] } = stats
  const totalKg      = campagnes.reduce((s, c) => s + (c.poids_total || 0), 0)
  const withRdt      = campagnes.filter(c => c.rendement_kgha > 0)
  const bestC        = withRdt.reduce((b, c) => !b || c.rendement_kgha > b.rendement_kgha ? c : b, null)
  const avgKgHa      = withRdt.length ? Math.round(withRdt.reduce((s, c) => s + c.rendement_kgha, 0) / withRdt.length) : null
  const campagnesDesc = [...campagnes].reverse()

  // Données filtrées par année pour la section répartition
  const filteredVendanges = selectedYear
    ? vendangesDetail.filter(v => v.annee === selectedYear)
    : vendangesDetail

  const communeItems = aggregateByCommune(filteredVendanges)
  const cepageItems  = aggregateByCepage(filteredVendanges)
  const breakdown    = tab === 'commune' ? communeItems : cepageItems

  const yearsDesc = [...campagnes].reverse().map(c => c.annee)

  return (
    <div className="pb-24">
      <PageHeader title="Statistiques" back="/vendange" />

      {/* Hero sombre */}
      <div className="bg-gradient-to-br from-vigne-900 via-vigne-800 to-vigne-700 px-4 pt-5 pb-8">
        <div className="grid grid-cols-2 gap-3">
          <HeroCard value={caToDisplayHa(surface_totale_ca)} label="Surface totale" />
          <HeroCard value={`${fmtK(totalKg)} kg`} label={`en ${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''}`} />
          <HeroCard value={avgKgHa ? `${avgKgHa.toLocaleString('fr-FR')} kg/ha` : '—'} label="Rendement moyen" />
          <HeroCard
            value={bestC ? `${bestC.rendement_kgha.toLocaleString('fr-FR')} kg/ha` : '—'}
            label={bestC ? `Record — ${bestC.annee}` : 'Meilleur rendement'}
            accent
          />
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-3">

        {/* Graphe rendement */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-gray-900">Rendement kg/ha</p>
            {campagnes.some(c => c.rendement_attendu_kgha) && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                objectif
              </div>
            )}
          </div>
          <RendementChart data={campagnes} />
        </div>

        {/* Graphe production */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 px-4 pt-4 pb-3">
          <p className="font-bold text-gray-900 mb-1">Production totale (kg)</p>
          <ProductionChart data={campagnes} />
        </div>

        {/* ── Section répartition (filtrée par année) ───────────────────── */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">

          {/* En-tête + sélecteur d'année */}
          <div className="px-4 pt-4 pb-2">
            <p className="font-bold text-gray-900 mb-3">Répartition</p>

            {/* Sélecteur d'année */}
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedYear(null)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedYear === null
                    ? 'bg-vigne-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Toutes
              </button>
              {yearsDesc.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedYear === y
                      ? 'bg-vigne-700 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Onglets Pressoir / Cépage */}
            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 mt-3">
              {[['commune', 'Pressoir'], ['cepage', 'Cépage']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            <BreakdownList items={breakdown} />
          </div>
        </div>

        {/* Liste par campagne */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <p className="font-bold text-gray-900">Par campagne</p>
            <p className="text-xs text-gray-400">{campagnes.length} années</p>
          </div>

          {campagnesDesc.map(c => {
            const isBest     = bestC && c.annee === bestC.annee
            const isClosed   = c.statut === 'cloturee'
            const vsObjectif = c.rendement_attendu_kgha && c.rendement_kgha
              ? Math.round((c.rendement_kgha - c.rendement_attendu_kgha) / c.rendement_attendu_kgha * 100)
              : null
            return (
              <button
                key={c.annee}
                onClick={() => navigate(`/vendange/${c.annee}`)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 text-left active:bg-gray-50 transition-colors ${
                  selectedYear === c.annee ? 'bg-amber-50' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                  isBest   ? 'bg-amber-100 ring-2 ring-amber-400 ring-offset-1' :
                  isClosed ? 'bg-gray-100' : 'bg-amber-50'
                }`}>
                  {isBest && <Award size={10} className="text-amber-500 mb-0.5" />}
                  <span className={`font-bold text-sm leading-tight ${isBest ? 'text-amber-700' : isClosed ? 'text-gray-500' : 'text-amber-600'}`}>
                    {c.annee}
                  </span>
                  {isClosed && !isBest && <Lock size={9} className="text-gray-400 mt-0.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-semibold text-gray-900 text-sm">
                      {c.poids_total ? Number(c.poids_total).toLocaleString('fr-FR') + ' kg' : '—'}
                    </p>
                    {c.rendement_kgha && (
                      <p className="text-xs text-vigne-700 font-medium">· {c.rendement_kgha.toLocaleString('fr-FR')} kg/ha</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.nb_vendanges} parcelle{c.nb_vendanges > 1 ? 's' : ''}
                    {c.caisses_total > 0 && ` · ${c.caisses_total} caisses`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {vsObjectif !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      vsObjectif >= 0 ? 'bg-vigne-100 text-vigne-700' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {vsObjectif >= 0 ? '+' : ''}{vsObjectif}%
                    </span>
                  )}
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}

function HeroCard({ value, label, accent }) {
  return (
    <div className={`rounded-2xl px-3.5 py-3 ${accent ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-white/10 border border-white/10'}`}>
      <p className={`text-xl font-bold leading-snug ${accent ? 'text-amber-300' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-vigne-300 mt-0.5">{label}</p>
    </div>
  )
}
