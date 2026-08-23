// Viticultural season: Oct 1 → Sep 30, labeled by harvest year
// e.g. Oct 2025–Sep 2026 = "Saison 2026"

export function getSaison(dateStr) {
  if (!dateStr) return null
  // Split on 'T' then '-' to parse as local date — avoids UTC midnight timezone flip
  // where e.g. "2025-10-01" (00:00 UTC) becomes Sep 30 in UTC-1+ timezones
  const datePart = dateStr.split('T')[0]
  const parts = datePart.split('-')
  if (parts.length < 2) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) // 1-12
  if (isNaN(year) || isNaN(month)) return null
  return month >= 10 ? year + 1 : year
}

export function getSaisonCourante() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  return month >= 10 ? year + 1 : year
}

export function tacheSaison(tache) {
  return getSaison(tache.date_debut || tache.date_echeance || tache.created_at)
}

// ISO week number (1-53)
export function getISOWeek(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length < 3) return null
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
}

// Infos complètes de la semaine ISO d'une date : numéro, clé triable, plage lun-dim
export function getWeekInfo(dateStr) {
  const week = getISOWeek(dateStr)
  if (week == null) return null
  const parts = dateStr.split('T')[0].split('-')
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  const thu = new Date(d); thu.setDate(thu.getDate() + 3 - (thu.getDay() + 6) % 7)
  const year = thu.getFullYear()
  const dow = (d.getDay() + 6) % 7
  const mon = new Date(d); mon.setDate(d.getDate() - dow)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = dd => dd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return {
    key:   `${year}-W${String(week).padStart(2, '0')}`,
    year, week,
    range: `${fmt(mon)} – ${fmt(sun)}`,
  }
}

// Today as YYYY-MM-DD (local time, no UTC shift)
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
