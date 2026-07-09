import { useRef, useState } from 'react'
import { Camera, X, Image } from 'lucide-react'

export default function PhotoInput({ value, onChange, label = 'Photo' }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(value || null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    onChange(file)
  }

  function handleRemove() {
    setPreview(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <label className="label">{label}</label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden">
          <img src={preview} alt="aperçu" className="w-full h-48 object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-vigne-300 rounded-xl h-36 flex flex-col items-center
                     justify-center gap-2 text-vigne-600 cursor-pointer active:bg-vigne-50 transition-colors"
        >
          <Camera size={32} />
          <span className="text-sm font-medium">Prendre une photo</span>
          <span className="text-xs text-gray-400">ou choisir depuis la galerie</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
