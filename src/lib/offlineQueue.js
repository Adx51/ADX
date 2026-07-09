import { openDB } from 'idb'

const DB_NAME = 'adx-offline'
const STORE = 'queue'

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

export async function removeOperation(id) {
  const db = await getDB()
  await db.delete(STORE, id)
}

export async function clearQueue() {
  const db = await getDB()
  await db.clear(STORE)
}

export async function getPendingCount() {
  const db = await getDB()
  return db.count(STORE)
}
