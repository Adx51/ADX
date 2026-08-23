import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Users, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import GroupeParcelles from '../../components/RapportParcelles'

// Rapport de récolte des parcelles en métayage, séparé par bailleur.
// C'est le récap par parcelle de la campagne — mêmes lignes, mêmes chiffres —
// mais groupé par bailleur au lieu de l'être par pressoir, pour pouvoir en
// remettre un exemplaire à chacun.
const TOUS = '__tous__'

export default function ReleveBailleurs() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState('')
  // Bailleur affiché. Le rapport se remet en main propre, un bailleur à la
  // fois : on ouvre donc sur un seul, pas sur la liste de tout le monde.
  const [sel, setSel] = useState(null)

  useEffect(() => {
    api.get(`/bailleurs/releve/${annee}`)
      .then(d => {
        setData(d)
        setSel((d?.bailleurs || [])[0]?.bailleur || null)
      })
      .catch(e => setErreur(e.message))
  }, [annee])

  if (erreur) return <div className="p-8 text-center text-gray-500">{erreur}</div>
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Chargement…</p>
    </div>
  )

  const affiches = sel && sel !== TOUS
    ? data.bailleurs.filter(b => b.bailleur === sel)
    : data.bailleurs

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/vendange/${annee}`)}
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-sm shrink-0">
            <ArrowLeft size={18} /> Retour
          </button>
          <p className="flex-1 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">
            Bailleurs {annee}
          </p>
          <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold shrink-0">
            <Printer size={14} /> Imprimer
          </button>
        </div>

        {/* Choix du bailleur : ce qui s'imprime est ce qui est affiché. */}
        {data.bailleurs.length > 1 && (
          <select value={sel ?? TOUS} onChange={e => setSel(e.target.value)}
                  className="input py-2 text-sm text-center font-medium">
            {data.bailleurs.map(b => (
              <option key={b.bailleur} value={b.bailleur}>{b.bailleur}</option>
            ))}
            <option value={TOUS}>Tous les bailleurs ({data.bailleurs.length})</option>
          </select>
        )}
      </div>

      <div className="light-content px-4 py-6 space-y-8 max-w-2xl mx-auto">
        {data.bailleurs.length === 0 ? (
          <div className="text-center py-16">
            <Users size={44} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune parcelle en métayage</p>
            <p className="text-gray-400 text-sm mt-1">
              Renseignez le bailleur sur une parcelle pour la voir apparaître ici.
            </p>
          </div>
        ) : (
          affiches.map(b => (
            <GroupeParcelles
              key={b.bailleur}
              annee={annee}
              titre={`PARCELLES DE ${b.bailleur.toUpperCase()}`}
              parcelles={b.parcelles}
            />
          ))
        )}
      </div>
    </div>
  )
}
