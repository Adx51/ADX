const IGN_API = 'https://apicarto.ign.fr/api/cadastre/parcelle'

function parseRef(raw) {
  const m = raw.trim().match(/^([A-Z]{1,3})\s*(\d{1,4})$/i)
  if (!m) return null
  return { section: m[1].toUpperCase(), numero: m[2].padStart(4, '0') }
}

function collectCoords(feature) {
  const g = feature.geometry
  const rings =
    g.type === 'Polygon' ? [g.coordinates[0]] :
    g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : []
  return rings.flatMap(([lng, lat]) => [[lat, lng]])
}

async function fetchFeatures(codeInsee, section, numero) {
  const attempts = [
    `${IGN_API}?code_insee=${codeInsee}&prefixe=000&section=${section}&numero=${numero}`,
    `${IGN_API}?code_insee=${codeInsee}&section=${section}&numero=${numero}`,
  ]
  for (const url of attempts) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const data = await resp.json()
      if (data.features?.length) return { features: data.features, testedUrl: url }
    } catch {}
  }
  return { features: [], testedUrl: attempts[0] }
}

export async function locateFromCadastre(codeInsee, referenceStr) {
  const refs = referenceStr.split(/[,;]/).map(parseRef).filter(Boolean)
  if (!refs.length) throw new Error('Format invalide. Attendu : AE0314 ou AE 0314, séparés par , ou ;')
  if (!codeInsee) throw new Error('Code INSEE manquant pour cette commune — configurez-le dans Admin → Référentiels.')

  const allCoords   = []
  const allFeatures = []
  const notFound    = []
  let sampleUrl     = ''

  for (const { section, numero } of refs) {
    const { features, testedUrl } = await fetchFeatures(codeInsee, section, numero)
    if (!sampleUrl) sampleUrl = testedUrl
    if (!features.length) {
      notFound.push(`${section} ${numero}`)
    } else {
      allFeatures.push(...features)
      features.forEach(f => allCoords.push(...collectCoords(f)))
    }
  }

  if (!allCoords.length) {
    const lines = [
      `Parcelle(s) introuvable(s) : ${notFound.join(', ')}`,
      `URL testée : ${sampleUrl}`,
      `→ Vérifiez le code INSEE ${codeInsee} dans Admin → Référentiels → Communes.`,
    ]
    throw new Error(lines.join('\n'))
  }

  const lat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
  const lng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
  return { lat: lat.toFixed(8), lng: lng.toFixed(8), notFound, features: allFeatures }
}
