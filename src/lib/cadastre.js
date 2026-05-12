const IGN_API = 'https://apicarto.ign.fr/api/cadastre/parcelle'

function parseRef(raw) {
  const m = raw.trim().match(/^([A-Z]{1,3})\s*0*(\d{1,4})$/i)
  if (!m) return null
  return { section: m[1].toUpperCase(), numero: m[2].padStart(4, '0') }
}

function collectCoords(feature) {
  const g = feature.geometry
  const rings =
    g.type === 'Polygon' ? [g.coordinates[0]] :
    g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : []
  return rings.flatMap(ring => ring.map(([lng, lat]) => [lat, lng]))
}

export async function locateFromCadastre(codeInsee, referenceStr) {
  const refs = referenceStr.split(',').map(parseRef).filter(Boolean)
  if (!refs.length) throw new Error('Aucune référence cadastrale valide trouvée (format attendu : AB 0012)')
  if (!codeInsee) throw new Error('Code INSEE manquant pour cette commune')

  const allCoords = []
  const notFound = []

  for (const { section, numero } of refs) {
    const url = `${IGN_API}?code_insee=${codeInsee}&section=${section}&numero=${numero}`
    const resp = await fetch(url)
    if (!resp.ok) continue
    const data = await resp.json()
    if (!data.features?.length) { notFound.push(`${section} ${numero}`); continue }
    data.features.forEach(f => allCoords.push(...collectCoords(f)))
  }

  if (!allCoords.length) {
    const msg = notFound.length ? `Parcelle(s) introuvable(s) : ${notFound.join(', ')}` : 'Aucune parcelle trouvée'
    throw new Error(msg)
  }

  const lat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
  const lng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
  return { lat: lat.toFixed(8), lng: lng.toFixed(8), notFound }
}
