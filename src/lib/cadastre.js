const IGN_API = 'https://apicarto.ign.fr/api/cadastre/parcelle'

function parseRef(raw) {
  // Accept "AE0314", "AE 0314", "AE 314" — section = letters, numero = digits (padded to 4)
  const m = raw.trim().match(/^([A-Z]{1,3})\s*(\d{1,4})$/i)
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

async function fetchFeatures(codeInsee, section, numero) {
  // The IGN API requires prefixe=000 (feuille cadastrale) in most cases
  const urls = [
    `${IGN_API}?code_insee=${codeInsee}&prefixe=000&section=${section}&numero=${numero}`,
    `${IGN_API}?code_insee=${codeInsee}&section=${section}&numero=${numero}`,
  ]
  for (const url of urls) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const data = await resp.json()
      if (data.features?.length) return data.features
    } catch {}
  }
  return []
}

export async function locateFromCadastre(codeInsee, referenceStr) {
  const refs = referenceStr.split(',').map(parseRef).filter(Boolean)
  if (!refs.length) throw new Error('Format invalide. Attendu : AE 0314 ou AE0314')
  if (!codeInsee) throw new Error('Code INSEE manquant pour cette commune — configurez-le dans Admin → Référentiels.')

  const allCoords = []
  const notFound = []

  for (const { section, numero } of refs) {
    const features = await fetchFeatures(codeInsee, section, numero)
    if (!features.length) {
      notFound.push(`${section} ${numero}`)
    } else {
      features.forEach(f => allCoords.push(...collectCoords(f)))
    }
  }

  if (!allCoords.length) {
    throw new Error(
      `Parcelle(s) introuvable(s) : ${notFound.join(', ')} — ` +
      `vérifiez le code INSEE ${codeInsee} dans Admin → Référentiels → Communes.`
    )
  }

  const lat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
  const lng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
  return { lat: lat.toFixed(8), lng: lng.toFixed(8), notFound }
}
