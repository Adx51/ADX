import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Award, Lock, BarChart2, Ruler, Package, TrendingUp, Trophy } from 'lucide-react'
import { api } from '../../lib/api'
import { caToDisplayHa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'

const YEAR_COLORS = ['#d97706', '#15803d', '#7c3aed', '#e11d48', '#0891b2', '#ea580c']

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

function aggregateByCommune(vendanges, multiYear = false) {
  const map = {}
  for (const v of vendanges) {
    const commune = v.commune_pressoir || 'Non défini'
    const key = multiYear ? `${commune}|||${v.annee}` : commune
    if (!map[key]) map[key] = { name: commune, annee: multiYear ? v.annee : null, poids: 0, surface: 0 }
    map[key].poids   += v.poids_total      || 0
    map[key].surface += v.surface_totale_ca || 0
  }
  const items = Object.values(map).map(g => ({
    ...g, kgha: g.surface > 0 ? Math.round(g.poids / (g.surface / 10000)) : null,
  }))
  if (!multiYear) return items.sort((a, b) => (b.poids || 0) - (a.poids || 0))
  const totals = {}
  for (const it of items) totals[it.name] = (totals[it.name] || 0) + it.poids
  return items.sort((a, b) => {
    const d = (totals[b.name] || 0) - (totals[a.name] || 0)
    return d !== 0 ? d : (a.annee || 0) - (b.annee || 0)
  })
}

function aggregateByCepage(vendanges, multiYear = false) {
  const map = {}
  for (const v of vendanges) {
    const cepages = v.cepages?.length > 0 ? v.cepages : ['Non précisé']
    const share = 1 / cepages.length
    for (const c of cepages) {
      const key = multiYear ? `${c}|||${v.annee}` : c
      if (!map[key]) map[key] = { name: c, annee: multiYear ? v.annee : null, poids: 0, surface: 0 }
      map[key].poids   += (v.poids_total      || 0) * share
      map[key].surface += (v.surface_totale_ca || 0) * share
    }
  }
  const items = Object.values(map).map(g => ({
    ...g, kgha: g.surface > 0 ? Math.round(g.poids / (g.surface / 10000)) : null,
  }))
  if (!multiYear) return items.sort((a, b) => (b.poids || 0) - (a.poids || 0))
  const totals = {}
  for (const it of items) totals[it.name] = (totals[it.name] || 0) + it.poids
  return items.sort((a, b) => {
    const d = (totals[b.name] || 0) - (totals[a.name] || 0)
    return d !== 0 ? d : (a.annee || 0) - (b.annee || 0)
  })
}

// ── Area chart : rendement kg/ha ─────────────────────────────────────────────
function RendementChart({ data }) {
  const W = 480, H = 160
  const PAD = { top: 32, right: 20, bottom: 32, left: 20 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const active = data.filter(d => d.rendement_kgha > 0)
  if (active.length < 2) return (
    <p className="text-sm text-gray-400 text-center py-8">Au moins 2 campagnes requises</p>
  )

  const vals      = active.map(d => d.rendement_kgha)
  const attenduV  = active.map(d => d.rendement_attendu_kgha || 0)
  const maxY      = Math.max(...vals, ...attenduV) * 1.2
  const n         = active.length
  const xPos = i  => PAD.left + (n > 1 ? i * CW / (n - 1) : CW / 2)
  const yPos = v  => PAD.top + CH - (v / maxY) * CH
  const pts       = active.map((d, i) => ({ x: xPos(i), y: yPos(d.rendement_kgha), val: d.rendement_kgha, annee: d.annee }))
  const linePath  = catmullRom(pts)
  const areaPath  = `${linePath} L ${pts[pts.length-1].x.toFixed(1)},${PAD.top+CH} L ${pts[0].x.toFixed(1)},${PAD.top+CH} Z`
  const attenduPts  = active.map((d, i) => d.rendement_attendu_kgha ? { x: xPos(i), y: yPos(d.rendement_attendu_kgha) } : null).filter(Boolean)
  const attenduPath = attenduPts.length >= 2 ? catmullRom(attenduPts) : null
  const midVal      = Math.round(Math.max(...vals) / 2)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="rdt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d97706" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[midVal, Math.max(...vals)].map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={yPos(v)} x2={W-PAD.right} y2={yPos(v)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PAD.left+2} y={yPos(v)-4} fontSize="9" fill="#9ca3af">{fmtK(v)}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#rdt-grad)" />
      {attenduPath && <path d={attenduPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,3" strokeLinecap="round" />}
      <path d={linePath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(p => (
        <g key={p.annee}>
          <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="#d97706" strokeWidth="2.5" />
          <text x={p.x} y={p.y-11} textAnchor="middle" fontSize="10" fill="#92400e" fontWeight="700">{fmtK(p.val)}</text>
        </g>
      ))}
      {active.map((d, i) => (
        <text key={d.annee} x={xPos(i)} y={H-8} textAnchor="middle" fontSize="11" fill="#9ca3af">{d.annee}</text>
      ))}
    </svg>
  )
}

// ── Bar chart : production totale kg ─────────────────────────────────────────
function ProductionChart({ data }) {
  const W = 480, H = 150
  const PAD = { top: 28, right: 20, bottom: 30, left: 20 }
  const CW  = W - PAD.left - PAD.right
  const CH  = H - PAD.top  - PAD.bottom

  const active  = data.filter(d => d.poids_total > 0)
  if (active.length < 1) return null

  const vals    = active.map(d => d.poids_total)
  const maxY    = Math.max(...vals) * 1.2
  const bestVal = Math.max(...vals)
  const n       = active.length
  // Largeur de créneau plafonnée → barres regroupées et centrées quand peu d'années
  const slot    = Math.min(CW / n, 120)
  const barW    = Math.min(slot * 0.62, 64)
  const startX  = PAD.left + (CW - slot * n) / 2
  const xCenter = i => startX + i * slot + slot / 2
  const yPos    = v => PAD.top + CH - (v / maxY) * CH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {active.map((d, i) => {
        const bh     = (d.poids_total / maxY) * CH
        const x      = xCenter(i) - barW / 2
        const y      = yPos(d.poids_total)
        const isBest = d.poids_total === bestVal
        // Record : vert foncé plein. Autres : vert clair — toujours lisible sur fond blanc.
        const color  = isBest ? '#15803d' : '#86efac'
        const textColor = isBest ? '#14532d' : '#166534'
        return (
          <g key={d.annee}>
            <rect x={x} y={y} width={barW} height={bh} rx="6" fill={color} />
            <text x={xCenter(i)} y={y-6} textAnchor="middle" fontSize="10" fill={textColor} fontWeight={isBest ? '700' : '600'}>{fmtK(d.poids_total)}</text>
            <text x={xCenter(i)} y={H-8} textAnchor="middle" fontSize="11" fill="#9ca3af">{d.annee}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Grouped vertical bars : répartition ──────────────────────────────────────
function BreakdownChart({ items, yearColors, multiYear }) {
  if (!items.length) return <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>

  const groupMap = new Map()
  for (const item of items) {
    if (!groupMap.has(item.name)) groupMap.set(item.name, [])
    groupMap.get(item.name).push(item)
  }
  const groups = Array.from(groupMap.values())

  const W = 320
  const labelH = multiYear ? 44 : 30
  const H = 180 + labelH
  const PAD = { top: 28, right: 10, bottom: labelH, left: 10 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const maxPoids  = Math.max(...items.map(i => i.poids || 0), 1)
  const nGroups   = groups.length
  const groupW    = CW / nGroups
  const nPerGroup = Math.max(...groups.map(g => g.length))
  const barW      = Math.min((groupW * 0.72) / nPerGroup, 36)
  const yPos = v  => PAD.top + CH - (v / maxPoids) * CH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0.5, 1].map(f => {
        const y = yPos(maxPoids * f)
        return (
          <g key={f}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD.left + 1} y={y - 3} fontSize="8" fill="#9ca3af">{fmtK(maxPoids * f)}</text>
          </g>
        )
      })}
      {groups.map((group, gi) => {
        const gCenterX  = PAD.left + gi * groupW + groupW / 2
        const totalBarW = barW * group.length
        const startX    = gCenterX - totalBarW / 2
        const name      = group[0].name
        const label     = name.length > 11 ? name.slice(0, 10) + '…' : name
        return (
          <g key={name}>
            {group.map((item, bi) => {
              const bh    = Math.max((item.poids / maxPoids) * CH, 2)
              const x     = startX + bi * barW
              const y     = PAD.top + CH - bh
              const color = item.annee && yearColors?.[item.annee] ? yearColors[item.annee] : '#f59e0b'
              return (
                <g key={bi}>
                  <rect x={x + 1} y={y} width={barW - 2} height={bh} rx="4" fill={color} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="8.5" fill={color} fontWeight="700">
                    {fmtK(item.poids)}
                  </text>
                  {multiYear && (
                    <text x={x + barW / 2} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill={color} fontWeight="600">
                      '{String(item.annee).slice(2)}
                    </text>
                  )}
                </g>
              )
            })}
            <text x={gCenterX} y={H - PAD.bottom + (multiYear ? 29 : 14)} textAnchor="middle" fontSize="9.5" fill="#6b7280">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ value, label, accent, sub }) {
  return (
    <div className={`rounded-2xl px-4 py-3.5 ${accent ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-white/10 border border-white/10'}`}>
      <p className={`text-2xl font-bold leading-snug ${accent ? 'text-amber-300' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-vigne-300 mt-0.5 leading-snug">{label}</p>
      {sub && <p className="text-xs text-vigne-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Desktop KPI card (light theme) ───────────────────────────────────────────
function KpiCardDesktop({ value, label, accent, sub, icon: Icon }) {
  return (
    <div className={`rounded-2xl px-5 py-4 flex items-start gap-3 ${accent ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
      {Icon && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ? 'bg-amber-200/60 text-amber-600' : 'bg-vigne-100 text-vigne-600'}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-snug ${accent ? 'text-amber-600' : 'text-gray-900'}`}>{value}</p>
        <p className={`text-xs mt-0.5 font-medium ${accent ? 'text-amber-500' : 'text-gray-500'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function StatsGlobales() {
  const navigate = useNavigate()
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [selectedYears, setSelectedYears] = useState(new Set())
  const [tab, setTab]             = useState('commune')
  const refreshTick = useRefreshTrigger()

  function toggleYear(y) {
    setSelectedYears(prev => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return next
    })
  }

  useEffect(() => {
    api.get('/campagnes/stats').then(data => {
      setStats(data)
      setLoading(false)
      setSelectedYears(new Set(data?.campagnes?.map(c => c.annee) || []))
    })
  }, [refreshTick])

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
  const totalKg       = campagnes.reduce((s, c) => s + (c.poids_total || 0), 0)
  const withRdt       = campagnes.filter(c => c.rendement_kgha > 0)
  const bestC         = withRdt.reduce((b, c) => !b || c.rendement_kgha > b.rendement_kgha ? c : b, null)
  const avgKgHa       = withRdt.length ? Math.round(withRdt.reduce((s, c) => s + c.rendement_kgha, 0) / withRdt.length) : null
  const campagnesDesc = [...campagnes].reverse()
  const yearsDesc     = campagnesDesc.map(c => c.annee)

  const yearColors = {}
  campagnes.forEach((c, i) => { yearColors[c.annee] = YEAR_COLORS[i % YEAR_COLORS.length] })

  const multiYear = selectedYears.size >= 2

  const filteredVendanges = selectedYears.size === 0
    ? vendangesDetail
    : vendangesDetail.filter(v => selectedYears.has(v.annee))

  const communeItems = aggregateByCommune(filteredVendanges, multiYear)
  const cepageItems  = aggregateByCepage(filteredVendanges, multiYear)
  const breakdown    = tab === 'commune' ? communeItems : cepageItems

  return (
    <div className="pb-10">
      <PageHeader title="Statistiques" back="/vendange" />

      {/* ── Hero mobile (dark gradient) ── */}
      <div className="md:hidden bg-gradient-to-br from-vigne-900 via-vigne-800 to-vigne-700 px-4 pt-5 pb-8">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard value={caToDisplayHa(surface_totale_ca)} label="Surface totale" />
          <KpiCard value={`${fmtK(totalKg)} kg`} label={`${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''}`} />
          <KpiCard value={avgKgHa ? `${avgKgHa.toLocaleString('fr-FR')} kg/ha` : '—'} label="Rendement moyen" />
          <KpiCard
            value={bestC ? `${bestC.rendement_kgha.toLocaleString('fr-FR')} kg/ha` : '—'}
            label={bestC ? `Record — ${bestC.annee}` : 'Meilleur rendement'}
            accent
          />
        </div>
      </div>

      {/* ── Hero desktop (light, 4-col KPIs) ── */}
      <div className="hidden md:block bg-gradient-to-r from-vigne-50/60 to-white border-b border-gray-100 px-6 py-5">
        <div className="grid grid-cols-4 gap-4">
          <KpiCardDesktop icon={Ruler} value={caToDisplayHa(surface_totale_ca)} label="Surface totale" sub={`${stats.nb_parcelles} parcelle${stats.nb_parcelles > 1 ? 's' : ''}`} />
          <KpiCardDesktop icon={Package} value={`${fmtK(totalKg)} kg`} label={`Production cumulée`} sub={`${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''}`} />
          <KpiCardDesktop icon={TrendingUp} value={avgKgHa ? `${avgKgHa.toLocaleString('fr-FR')} kg/ha` : '—'} label="Rendement moyen" />
          <KpiCardDesktop
            icon={Trophy}
            value={bestC ? `${bestC.rendement_kgha.toLocaleString('fr-FR')} kg/ha` : '—'}
            label={bestC ? `Record — ${bestC.annee}` : 'Meilleur rendement'}
            accent
          />
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="md:hidden px-4 space-y-4 -mt-3">
        {/* Graphe rendement */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-gray-900">Rendement kg/ha</p>
            {campagnes.some(c => c.rendement_attendu_kgha) && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
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

        {/* Répartition */}
        <BreakdownSection
          yearsDesc={yearsDesc} selectedYears={selectedYears} toggleYear={toggleYear}
          yearColors={yearColors} tab={tab} setTab={setTab}
          breakdown={breakdown} multiYear={multiYear}
        />

        {/* Par campagne */}
        <CampagnesTable campagnesDesc={campagnesDesc} bestC={bestC} navigate={navigate} />
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:block px-6 py-5">
        {/* Row 1: Charts (2/3) + Répartition (1/3) */}
        <div className="grid grid-cols-3 gap-5 items-start">

          {/* Left: 2 charts stacked */}
          <div className="col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-gray-900">Rendement kg/ha</p>
                {campagnes.some(c => c.rendement_attendu_kgha) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,3" /></svg>
                    objectif appellation
                  </div>
                )}
              </div>
              <RendementChart data={campagnes} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-4 pb-4">
              <p className="font-bold text-gray-900 mb-3">Production totale (kg)</p>
              <ProductionChart data={campagnes} />
            </div>
          </div>

          {/* Right: Répartition */}
          <div className="col-span-1">
            <BreakdownSection
              yearsDesc={yearsDesc} selectedYears={selectedYears} toggleYear={toggleYear}
              yearColors={yearColors} tab={tab} setTab={setTab}
              breakdown={breakdown} multiYear={multiYear}
              desktop
            />
          </div>
        </div>

        {/* Row 2: Par campagne full width */}
        <div className="mt-5">
          <CampagnesTable campagnesDesc={campagnesDesc} bestC={bestC} navigate={navigate} desktop />
        </div>
      </div>
    </div>
  )
}

// ── Répartition section (shared mobile/desktop) ───────────────────────────────
function BreakdownSection({ yearsDesc, selectedYears, toggleYear, yearColors, tab, setTab, breakdown, multiYear, desktop }) {
  return (
    <div className={`bg-white border border-gray-100 overflow-hidden ${desktop ? 'rounded-2xl shadow-sm' : 'rounded-3xl shadow-md'}`}>
      <div className="px-4 pt-4 pb-2">
        <p className="font-bold text-gray-900 mb-3">Répartition</p>

        {/* Year pills */}
        <div className="flex flex-wrap gap-2 pb-1">
          {yearsDesc.map(y => {
            const isActive = selectedYears.has(y)
            const color    = yearColors[y]
            return (
              <button
                key={y}
                onClick={() => toggleYear(y)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={isActive
                  ? { backgroundColor: color, color: '#fff' }
                  : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                }
              >
                {y}
              </button>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 mt-3">
          {[['commune', 'Pressoir'], ['cepage', 'Cépage']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 pt-2">
        <BreakdownChart items={breakdown} yearColors={yearColors} multiYear={multiYear} />
      </div>
    </div>
  )
}

// ── Par campagne table ────────────────────────────────────────────────────────
function CampagnesTable({ campagnesDesc, bestC, navigate, desktop }) {
  return (
    <div className={`bg-white border border-gray-100 overflow-hidden ${desktop ? 'rounded-2xl shadow-sm' : 'rounded-3xl shadow-md'}`}>
      <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
        <p className="font-bold text-gray-900">Par campagne</p>
        <p className="text-xs text-gray-400">{campagnesDesc.length} années</p>
      </div>

      {/* Desktop table header */}
      {desktop && (
        <div className="hidden md:grid grid-cols-[3rem_1fr_1fr_1fr_auto_1.5rem] items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Année</span>
          <span>Production</span>
          <span>Rendement</span>
          <span>Parcelles</span>
          <span>vs Objectif</span>
          <span />
        </div>
      )}

      {campagnesDesc.map(c => {
        const isBest   = bestC && c.annee === bestC.annee
        const isClosed = c.statut === 'cloturee'
        const noData   = !c.poids_total && !c.nb_vendanges
        const vsObjectif = c.rendement_attendu_kgha && c.rendement_kgha
          ? Math.round((c.rendement_kgha - c.rendement_attendu_kgha) / c.rendement_attendu_kgha * 100)
          : null

        return (
          <button
            key={c.annee}
            onClick={() => navigate(`/vendange/${c.annee}`)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 text-left active:bg-gray-50 transition-colors
              ${noData ? 'opacity-45' : ''}
              ${desktop ? 'md:grid md:grid-cols-[3rem_1fr_1fr_1fr_auto_1.5rem] md:gap-4 md:py-3' : ''}`}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 md:w-10 md:h-10 md:rounded-xl ${
              isBest   ? 'bg-amber-100 ring-2 ring-amber-400 ring-offset-1' :
              isClosed ? 'bg-gray-100' : 'bg-amber-50'
            }`}>
              {isBest && <Award size={10} className="text-amber-500 mb-0.5" />}
              <span className={`font-bold text-sm leading-tight ${isBest ? 'text-amber-700' : isClosed ? 'text-gray-500' : 'text-amber-600'}`}>
                {c.annee}
              </span>
              {isClosed && !isBest && <Lock size={9} className="text-gray-400 mt-0.5" />}
            </div>

            {/* Mobile: single grouped cell */}
            <div className={`flex-1 min-w-0 ${desktop ? 'md:contents' : ''}`}>
              {/* Production */}
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {c.poids_total ? Number(c.poids_total).toLocaleString('fr-FR') + ' kg' : '—'}
                </p>
                <p className={`text-xs text-gray-400 mt-0.5 ${desktop ? 'md:hidden' : ''}`}>
                  {c.nb_vendanges} parcelle{c.nb_vendanges > 1 ? 's' : ''}
                  {c.caisses_total > 0 && ` · ${c.caisses_total} caisses`}
                </p>
              </div>

              {/* Rendement */}
              <div>
                <p className={`text-sm text-vigne-700 font-medium ${desktop ? '' : 'inline'}`}>
                  {c.rendement_kgha ? `${c.rendement_kgha.toLocaleString('fr-FR')} kg/ha` : '—'}
                </p>
              </div>

              {/* Parcelles (desktop only) */}
              {desktop && (
                <p className="hidden md:block text-sm text-gray-500">
                  {c.nb_vendanges} parcelle{c.nb_vendanges > 1 ? 's' : ''}
                  {c.caisses_total > 0 && <><br /><span className="text-xs text-gray-400">{c.caisses_total} caisses</span></>}
                </p>
              )}
            </div>

            {/* vs Objectif */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {vsObjectif !== null && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  vsObjectif >= 0 ? 'bg-vigne-100 text-vigne-700' : 'bg-orange-100 text-orange-600'
                }`}>
                  {vsObjectif >= 0 ? '+' : ''}{vsObjectif}%
                </span>
              )}
            </div>

            <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
          </button>
        )
      })}
    </div>
  )
}
