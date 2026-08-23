import { openDB } from 'idb'

const DB_NAME = 'adx-offline'
const STORE = 'queue'

// ⚠ RÈGLE ABSOLUE : une opération d'écriture mise en file n'est JAMAIS
// supprimée automatiquement tant qu'elle n'a pas été acceptée par le serveur.
// En pleine vendange, une saisie perdue est une pesée perdue. En cas d'échec
// définitif (4xx), l'opération est marquée `failed` et CONSERVÉE pour que
// l'utilisateur puisse la voir et la ressaisir.

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

export async function enqueueOperation(op) {
  const db = await getDB()
  await db.add(STORE, { ...op, timestamp: Date.now() })
}

export async function getPendingOperations() {
  const db = await getDB()
  return db.getAll(STORE)
}

// Marque une opération comme définitivement refusée par le serveur, sans la
// supprimer : elle reste consultable pour ressaisie manuelle.
export async function markOperationFailed(id, error) {
  const db = await getDB()
  const op = await db.get(STORE, id)
  if (!op) return
  await db.put(STORE, { ...op, failed: true, error: error || 'Refusée par le serveur' })
}

export async function removeOperation(id) {
  const db = await getDB()
  await db.delete(STORE, id)
}

export async function clearQueue() {
  const db = await getDB()
  await db.clear(STORE)
}

// Compteurs séparés : en attente d'envoi vs en échec définitif
export async function getQueueStats() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return {
    pending: all.filter(o => !o.failed).length,
    failed:  all.filter(o => o.failed).length,
    all,
  }
}

export async function getPendingCount() {
  const { pending } = await getQueueStats()
  return pending
}
