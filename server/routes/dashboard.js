import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Cache mémoire simple
const _cache = {}
function fromCache(key, ttlMs) {
  const e = _cache[key]
  return e && Date.now() - e.ts < ttlMs ? e.data : null
}
function setCache(key, data) { _cache[key] = { ts: Date.now(), data } }

// WMO weather codes → emoji + libellé
const WMO = {
  0: ['☀️','Ciel dégagé'], 1: ['🌤','Peu nuageux'], 2: ['⛅','Partiellement nuageux'],
  3: ['☁️','Couvert'], 45: ['🌫','Brouillard'], 48: ['🌫','Brouillard givrant'],
  51: ['🌦','Bruine légère'], 53: ['🌦','Bruine'], 55: ['🌦','Bruine dense'],
  61: ['🌧','Pluie légère'], 63: ['🌧','Pluie'], 65: ['🌧','Pluie forte'],
  71: ['🌨','Neige légère'], 73: ['❄️','Neige'], 75: ['❄️','Neige forte'],
  77: ['🌨','Grésil'], 80: ['🌦','Averses'], 81: ['🌦','Averses mod.'],
  82: ['⛈','Averses violentes'], 85: ['🌨','Averses neige'], 86: ['❄️','Averses neige forte'],
  95: ['⛈','Orage'], 96: ['⛈','Orage+grêle'], 99: ['⛈','Orage violent'],
}
function wmo(code) { return WMO[code] || ['🌡','Variable'] }

// GET /api/dashboard/weather
router.get('/weather', async (req, res) => {
  const cached = fromCache('weather', 20 * 60 * 1000)
  if (cached) return res.json(cached)
  try {
    const lat = 48.98, lng = 4.06  // Chouilly, Champagne
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weathercode,windspeed_10m,precipitation,relative_humidity_2m` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum` +
      `&timezone=Europe%2FParis&forecast_days=6`
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const j = await resp.json()
    const c = j.current
    const d = j.daily
    const [emoji, desc] = wmo(c.weathercode)
    const result = {
      current: {
        temp: Math.round(c.temperature_2m), emoji, desc,
        wind: Math.round(c.windspeed_10m),
        precip: c.precipitation,
        humidity: c.relative_humidity_2m,
      },
      forecast: d.time.slice(1, 6).map((date, i) => {
        const [fe] = wmo(d.weathercode[i + 1])
        return {
          date,
          tmax: Math.round(d.temperature_2m_max[i + 1]),
          tmin: Math.round(d.temperature_2m_min[i + 1]),
          emoji: fe,
          precip: d.precipitation_sum[i + 1],
        }
      }),
    }
    setCache('weather', result)
    res.json(result)
  } catch {
    res.status(503).json({ error: 'Météo indisponible' })
  }
})

// Parse RSS basique (CDATA + texte brut)
function parseRSS(xml) {
  const items = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1]
    const get = tag => {
      const r = body.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))
      return r ? r[1].trim() : ''
    }
    const title = get('title')
    const link  = get('link') || body.match(/<link\s*\/>[\s]*([^\s<]+)/)?.[1] || ''
    const pub   = get('pubDate')
    const src   = body.match(/<source[^>]*>([^<]*)<\/source>/)?.[1] || ''
    if (title.length > 8) items.push({ title, link, pubDate: pub ? new Date(pub).getTime() : 0, source: src })
  }
  return items
}

// Sources connues pour être derrière un paywall
const PAYWALL_SOURCES = new Set([
  'Le Monde', 'Le Figaro', 'Les Échos', "L'Express", 'Le Point',
  "L'Obs", 'Challenges', 'Capital', 'Marianne', 'La Croix',
  "L'Opinion", 'La Tribune', 'Mediapart', 'Libération',
])

const FEEDS = [
  { url: 'https://news.google.com/rss/search?q=champagne+viticulture+vignoble&hl=fr&gl=FR&ceid=FR:fr',   tag: 'Champagne' },
  { url: 'https://news.google.com/rss/search?q=CIVC+comit%C3%A9+champagne&hl=fr&gl=FR&ceid=FR:fr',       tag: 'CIVC' },
  { url: 'https://news.google.com/rss/search?q=Chouilly+champagne+vigne&hl=fr&gl=FR&ceid=FR:fr',         tag: 'Chouilly' },
  { url: 'https://news.google.com/rss/search?q=Hautvillers+champagne+vigne&hl=fr&gl=FR&ceid=FR:fr',      tag: 'Hautvillers' },
]

// GET /api/dashboard/news
router.get('/news', async (req, res) => {
  const cached = fromCache('news', 30 * 60 * 1000)
  if (cached) return res.json(cached)

  const all = []
  await Promise.allSettled(FEEDS.map(async ({ url, tag }) => {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ADXVignoble/1.0)' },
        signal: AbortSignal.timeout(7000),
      })
      const text = await r.text()
      parseRSS(text).slice(0, 4).forEach(item => all.push({ ...item, tag }))
    } catch {}
  }))

  const seen = new Set()
  const news = all
    .filter(item => !PAYWALL_SOURCES.has(item.source))
    .filter(item => { const k = item.title.toLowerCase().slice(0, 50); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, 10)
    .map(({ title, link, pubDate, source, tag }) => ({ title, link, pubDate, source, tag }))

  setCache('news', news)
  res.json(news)
})

export default router
