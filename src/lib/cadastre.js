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
  return rings.flatMap(ring => ring.map(([lng, lat]) => [lat, lng]))
}

async function fetchFeatures(codeInsee, section, numero) {
  const attempts = [
    { prefixe: '000', url: `${IGN_API}?code_insee=${codeInsee}&prefixe=000&section=${section}&numero=${numero}` },
    { prefixe: null,  url: `${IGN_API}?code_insee=${codeInsee}&section=${section}&numero=${numero}` },
  ]
  for (const attempt of attempts) {
    try {
      const resp = await fetch(attempt.url)
      if (!resp.ok) continue
      const data = await resp.json()
      if (data.features?.length) return { features: data.features, testedUrl: attempt.url }
    } catch {}
  }
  // Return last URL tried so user can inspect it
  return { features: [], testedUrl: attempts[0].url }
}

export async function locateFromCadastre(codeInsee, referenceStr) {
  const refs = referenceStr.split(',').map(parseRef).filter(Boolean)
  if (!refs.length) throw new Error('Format invalide. Attendu : AE 0314 ou AE0314')
  if (!codeInsee) throw new Error('Code INSEE manquant pour cette commune — configurez-le dans Admin → Référentiels.')

  const allCoords = []
  const notFound = []
  let sampleUrl = ''

  for (const { section, numero } of refs) {
    const { features, testedUrl } = await fetchFeatures(codeInsee, section, numero)
    if (!sampleUrl) sampleUrl = testedUrl
    if (!features.length) {
      notFound.push(`${section} ${numero}`)
    } else {
      features.forEach(f => allCoords.push(...collectCoords(f)))
    }
  }

  if (!allCoords.length) {
    const lines = [
      `Parcelle(s) introuvable(s) : ${notFound.join(', ')}`,
      ``,
      `URL testée : ${sampleUrl}`,
      `→ Ouvrez ce lien dans votre navigateur pour voir la réponse brute de l'IGN.`,
      `→ Si la réponse est vide, vérifiez le code INSEE ${codeInsee} (Admin → Référentiels → Communes).`,
    ]
    throw new Error(lines.join('\n'))
  }

  const lat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
  const lng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
  return { lat: lat.toFixed(8), lng: lng.toFixed(8), notFound }
}
