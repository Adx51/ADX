import { ArrowLeft } from 'lucide-react'
import { useBack } from '../lib/useBack'

export default function PageHeader({ title, back, children }) {
  const goBack = useBack(back)
  return (
    <div className="page-header flex items-center gap-3">
      {back && (
        <button
          onClick={goBack}
          className="p-1 -ml-1 rounded-full active:bg-vigne-600"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <h1 className="text-lg font-bold flex-1 leading-tight break-words">{title}</h1>
      {children}
    </div>
  )
}
