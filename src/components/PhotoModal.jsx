import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function PhotoModal({ url, onClose }) {
  useEffect(() => {
    if (!url) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [url, onClose])

  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
        onClick={onClose}
      >
        <X size={28} />
      </button>
      <img
        src={url}
        alt=""
        className="max-w-full max-h-full object-contain p-4"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
