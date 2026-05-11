import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({ title, back, children }) {
  const navigate = useNavigate()
  return (
    <div className="page-header flex items-center gap-3">
      {back && (
        <button
          onClick={() => navigate(back)}
          className="p-1 -ml-1 rounded-full active:bg-vigne-600"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
      {children}
    </div>
  )
}
