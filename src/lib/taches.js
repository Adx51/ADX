import { Clock, AlertCircle, Check } from 'lucide-react'

// Constantes partagées tâches + traitements — source unique pour
// TachesList, ParcelleDetail, TacheForm et les pages Phyto.

export const STATUT_TACHE = {
  a_faire:  { label: 'À faire',  badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',         Icon: Clock },
  en_cours: { label: 'En cours', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',       Icon: AlertCircle },
  termine:  { label: 'Terminée', badge: 'bg-vigne-100 text-vigne-700 dark:bg-vigne-900/30 dark:text-vigne-400',   Icon: Check },
}

export const PRIORITE_DOT = {
  haute:   'bg-red-500',
  normale: null,
  basse:   'bg-gray-300 dark:bg-gray-600',
}

export const TYPE_TRAITEMENT = {
  fongicide:   { label: 'Fongicide',   badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  insecticide: { label: 'Insecticide', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  herbicide:   { label: 'Herbicide',   badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  biocontrole: { label: 'Biocontrôle', badge: 'bg-vigne-100 text-vigne-700 dark:bg-vigne-900/30 dark:text-vigne-400' },
  autre:       { label: 'Autre',       badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
}

export function typeBadge(type) {
  return (TYPE_TRAITEMENT[type] || TYPE_TRAITEMENT.autre).badge
}
