/**
 * Recording buffer — wrapper IndexedDB pour stocker temporairement les prises
 * vidéo avant leur upload réussi. Permet une recovery transparente si le
 * navigateur/onglet crashe au milieu d'un tournage ou si l'upload échoue.
 *
 * Policy (F8) :
 *   - Quota checking via `navigator.storage.estimate()` — si l'espace libre
 *     tombe sous `blob.size × 1.5`, on retourne `saved: false` et laissons
 *     RecordingSession fallback sur l'upload synchrone direct.
 *   - TTL 7 jours : `purgeExpired` à appeler au mount. Efface tout take dont
 *     `meta.recordedAt` est plus vieux que maxAge (défaut 7j).
 *   - Privacy : on ne stocke PAS la transcription, juste le blob vidéo brut
 *     + questionId + durée. Effacé dès que l'upload confirme OK.
 *   - Cross-device (Task 7.5) : `listAllOrphanedSessions()` permet de
 *     détecter les takes d'autres sessions restés sans clear (ex : un crash
 *     après submit). `ResumeBanner` peut vérifier l'état server-side et
 *     auto-clear si la session est déjà DONE/LIVE/REPLACED.
 */

const DB_NAME = 'lavidz-recording-buffer'
const DB_VERSION = 1
const STORE = 'recordingBuffers'
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const QUOTA_SAFETY_MARGIN = 1.5

export type BufferedTakeMeta = {
  duration: number
  recordedAt: string
  mimeType?: string
}

export type BufferedTake = {
  takeId: string
  sessionId: string
  questionId: string
  blob: Blob
  meta: BufferedTakeMeta
}

type StoredTake = BufferedTake

function hasIndexedDB(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'takeId' })
        store.createIndex('bySession', 'sessionId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const result = run(store)
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result as T)
          result.onerror = () => reject(result.error ?? new Error('IndexedDB op failed'))
        } else {
          result.then(resolve).catch(reject)
        }
        t.onerror = () => reject(t.error ?? new Error('IndexedDB tx failed'))
      }),
  )
}

export async function isBufferAvailable(): Promise<{
  available: boolean
  reason?: 'no-indexeddb' | 'quota-low'
  quotaBytes?: number
}> {
  if (!hasIndexedDB()) return { available: false, reason: 'no-indexeddb' }
  try {
    const est = await navigator.storage?.estimate?.()
    const quota = est?.quota ?? 0
    const usage = est?.usage ?? 0
    const free = quota - usage
    // Safe default: si quota est inconnu, on accepte (Safari ancien peut ne rien
    // retourner mais IndexedDB marche quand même).
    if (quota > 0 && free < 10 * 1024 * 1024) {
      return { available: false, reason: 'quota-low', quotaBytes: free }
    }
    return { available: true, quotaBytes: free }
  } catch {
    return { available: true }
  }
}

function generateTakeId(): string {
  return `take_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export async function saveTake(
  sessionId: string,
  questionId: string,
  blob: Blob,
  meta: BufferedTakeMeta,
): Promise<{ takeId: string; saved: boolean; reason?: string }> {
  if (!hasIndexedDB()) {
    return { takeId: '', saved: false, reason: 'no-indexeddb' }
  }
  // Quota check avec safety margin × 1.5 (F8)
  try {
    const est = await navigator.storage?.estimate?.()
    const quota = est?.quota ?? 0
    const usage = est?.usage ?? 0
    const free = quota - usage
    if (quota > 0 && free < blob.size * QUOTA_SAFETY_MARGIN) {
      return { takeId: '', saved: false, reason: 'quota-low' }
    }
  } catch {
    // ignore — on tente le save, si ça échoue le catch bloc s'en occupe
  }

  const takeId = generateTakeId()
  const record: StoredTake = { takeId, sessionId, questionId, blob, meta }
  try {
    await tx<IDBValidKey>('readwrite', (store) => store.put(record))
    return { takeId, saved: true }
  } catch (err) {
    return { takeId: '', saved: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function listBufferedTakes(sessionId: string): Promise<BufferedTake[]> {
  if (!hasIndexedDB()) return []
  try {
    return await tx<BufferedTake[]>('readonly', (store) => {
      const index = store.index('bySession')
      const req = index.getAll(IDBKeyRange.only(sessionId))
      return req as unknown as IDBRequest<BufferedTake[]>
    })
  } catch {
    return []
  }
}

export async function clearTake(takeId: string): Promise<void> {
  if (!hasIndexedDB() || !takeId) return
  try {
    await tx<undefined>('readwrite', (store) => store.delete(takeId))
  } catch {
    // silent — si l'entrée n'existe déjà plus, pas un drame
  }
}

export async function clearBuffer(sessionId: string): Promise<void> {
  if (!hasIndexedDB()) return
  try {
    const takes = await listBufferedTakes(sessionId)
    await Promise.all(takes.map((t) => clearTake(t.takeId)))
  } catch {
    // silent
  }
}

export async function listAllOrphanedSessions(): Promise<string[]> {
  if (!hasIndexedDB()) return []
  try {
    const all = await tx<StoredTake[]>('readonly', (store) =>
      store.getAll() as unknown as IDBRequest<StoredTake[]>,
    )
    const set = new Set<string>()
    for (const t of all) set.add(t.sessionId)
    return Array.from(set)
  } catch {
    return []
  }
}

export async function purgeExpired(maxAgeMs: number = DEFAULT_TTL_MS): Promise<number> {
  if (!hasIndexedDB()) return 0
  try {
    const all = await tx<StoredTake[]>('readonly', (store) =>
      store.getAll() as unknown as IDBRequest<StoredTake[]>,
    )
    const now = Date.now()
    const toPurge = all.filter((t) => {
      const recordedAt = Date.parse(t.meta.recordedAt)
      if (Number.isNaN(recordedAt)) return true
      return now - recordedAt > maxAgeMs
    })
    await Promise.all(toPurge.map((t) => clearTake(t.takeId)))
    return toPurge.length
  } catch {
    return 0
  }
}
