// Viticultural season: Oct 1 → Sep 30, labeled by harvest year
// e.g. Oct 2025–Sep 2026 = "Saison 2026"

export function getSaison(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 1-12
  return month >= 10 ? year + 1 : year
}

export function getSaisonCourante() {
  return getSaison(new Date().toISOString())
}

export function tacheSaison(tache) {
  return getSaison(tache.date_echeance || tache.created_at)
}
