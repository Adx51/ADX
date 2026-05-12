import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix broken default marker icons in Vite/webpack builds
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

// Champagne region default center (near Épernay)
const DEFAULT_LAT = 49.04
const DEFAULT_LNG = 3.98
const DEFAULT_ZOOM = 13

export default function MapPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return

    const initLat = lat ? parseFloat(lat) : DEFAULT_LAT
    const initLng = lng ? parseFloat(lng) : DEFAULT_LNG
    const zoom = lat ? 15 : DEFAULT_ZOOM

    const map = L.map(containerRef.current).setView([initLat, initLng], zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    if (lat && lng) {
      markerRef.current = L.marker([parseFloat(lat), parseFloat(lng)]).addTo(map)
    }

    map.on('click', e => {
      const { lat: clickLat, lng: clickLng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng])
      } else {
        markerRef.current = L.marker([clickLat, clickLng]).addTo(map)
      }
      onChange(clickLat.toFixed(8), clickLng.toFixed(8))
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="h-56 rounded-xl border border-gray-200 overflow-hidden" style={{ zIndex: 0 }} />
      <p className="text-xs text-gray-400 text-center">Appuyez sur la carte pour placer le marqueur</p>
    </div>
  )
}
