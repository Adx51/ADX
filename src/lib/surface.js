// Surface stored internally in centiares (ca)
// 1 are = 100 ca, 1 ha = 100 ares = 10 000 ca
// Display format: "32 A 21" = 32 ares 21 centiares

export function caToDisplay(ca) {
  if (!ca && ca !== 0) return '—'
  const ares = Math.floor(ca / 100)
  const centi = ca % 100
  if (centi === 0) return `${ares} A`
  return `${ares} A ${String(centi).padStart(2, '0')}`
}

export function caToHa(ca) {
  if (!ca && ca !== 0) return 0
  return ca / 10000
}

// Parse "32 21" or "3221" or "32" input → centiares
export function parseToCa(ares, ca = 0) {
  const a = parseInt(ares) || 0
  const c = parseInt(ca) || 0
  return a * 100 + c
}

export function rendementKgHa(poidsTotalKg, surfacePlanteeCa) {
  if (!surfacePlanteeCa || surfacePlanteeCa === 0) return null
  const ha = caToHa(surfacePlanteeCa)
  return Math.round(poidsTotalKg / ha)
}
