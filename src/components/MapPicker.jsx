import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

const DEFAULT_CENTER = [49.04, 3.98]
const DEFAULT_ZOOM   = 13

// IGN Géoportail — free, no API key required via data.geopf.fr
const AERIAL_URL   = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image%2Fjpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
const CADASTRE_URL = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=bdparcellaire&FORMAT=image%2Fpng&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
const OSM_URL      = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

const PARCEL_STYLE = { color: '#15803d', weight: 2.5, opacity: 1, fillColor: '#16a34a', fillOpacity: 0.15 }

export default function MapPicker({ lat, lng, onChange, geoFeatures }) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const markerRef     = useRef(null)
  const geoLayerRef   = useRef(null)

  // ── Initialize map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    const initLat = lat ? parseFloat(lat) : DEFAULT_CENTER[0]
    const initLng = lng ? parseFloat(lng) : DEFAULT_CENTER[1]
    const zoom    = lat ? 17 : DEFAULT_ZOOM

    const map = L.map(containerRef.current, { zoomControl: true }).setView([initLat, initLng], zoom)

    const aerial   = L.tileLayer(AERIAL_URL,   { attribution: '© IGN-F/Géoportail', maxZoom: 21 })
    const osm      = L.tileLayer(OSM_URL,      { attribution: '© OpenStreetMap',    maxZoom: 19 })
    const cadastre = L.tileLayer(CADASTRE_URL, { attribution: '© IGN Cadastre',     maxZoom: 21, opacity: 0.7 })

    aerial.addTo(map)
    cadastre.addTo(map)

    L.control.layers(
      { '🛰 Vue aérienne': aerial, '🗺 Plan': osm },
      { '📐 Cadastre': cadastre },
      { position: 'topright', collapsed: true }
    ).addTo(map)

    if (lat && lng) {
      markerRef.current = L.marker([parseFloat(lat), parseFloat(lng)]).addTo(map)
    }

    map.on('click', e => {
      const { lat: cLat, lng: cLng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([cLat, cLng])
      } else {
        markerRef.current = L.marker([cLat, cLng]).addTo(map)
      }
      onChange(cLat.toFixed(8), cLng.toFixed(8))
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current   = null
      markerRef.current  = null
      geoLayerRef.current = null
    }
  }, [])

  // ── Sync marker when lat/lng change ──────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return
    const pLat = parseFloat(lat), pLng = parseFloat(lng)
    if (isNaN(pLat) || isNaN(pLng)) return
    if (markerRef.current) {
      markerRef.current.setLatLng([pLat, pLng])
    } else {
      markerRef.current = L.marker([pLat, pLng]).addTo(mapRef.current)
    }
  }, [lat, lng])

  // ── Draw cadastral parcel polygons when features arrive ──────────────────
  useEffect(() => {
    if (!mapRef.current) return
    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null }
    if (!geoFeatures?.length) return

    const layer = L.geoJSON(geoFeatures, { style: PARCEL_STYLE }).addTo(mapRef.current)
    geoLayerRef.current = layer
    mapRef.current.fitBounds(layer.getBounds(), { padding: [30, 30] })
  }, [geoFeatures])

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="h-72 rounded-xl border border-gray-200 overflow-hidden" style={{ zIndex: 0 }} />
      <p className="text-xs text-gray-400 text-center">Appuyez sur la carte pour ajuster la position</p>
    </div>
  )
}
