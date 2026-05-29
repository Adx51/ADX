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
  return getSaison(tache.date_echeance || tache.created_at)
}
