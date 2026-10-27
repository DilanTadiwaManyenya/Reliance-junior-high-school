const DATABASE = 'reliance-learning-library-drafts'
const STORE = 'drafts'
const VERSION = 1
const MAX_AGE = 24 * 60 * 60 * 1000

export function learningLibraryDraftKey(teacherId, scope) {
  return `reliance:learning-library:draft:${encodeURIComponent(JSON.stringify({
    teacherId,
    campus: scope.campus,
    class_level: scope.class_level,
    class_stream: scope.class_stream || '',
    subject: scope.subject,
    allocation_id: scope.allocation_id || scope.id || '',
  }))}`
}

export function readLearningLibraryDraftMetadata(key) {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || 'null')
    if (!value || Date.now() - value.savedAt > MAX_AGE || !value.form?.id) return null
    return value
  } catch { return null }
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB unavailable'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, operation) {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode)
      const store = transaction.objectStore(STORE)
      let request
      try { request = operation(store) } catch (error) { reject(error); return }
      transaction.oncomplete = () => resolve(request?.result)
      transaction.onerror = () => reject(transaction.error || request?.error)
      transaction.onabort = () => reject(transaction.error || new Error('Draft storage was interrupted'))
    })
  } finally { database.close() }
}

export async function saveLearningLibraryDraft(key, form, file, saved = null) {
  const metadata = {
    savedAt: Date.now(),
    form: { ...form },
    saved: saved ? {
      id: saved.id, state: saved.state, title: saved.title, description: saved.description,
      academic_year: saved.academic_year, term: saved.term,
      portal_content_files: saved.portal_content_files || [],
    } : null,
  }
  try { window.sessionStorage.setItem(key, JSON.stringify(metadata)) } catch { /* Browser storage can be unavailable in private browsing. */ }
  try {
    await transact('readwrite', store => store.put({
      ...metadata,
      key,
      file: file ? { blob: file, name: file.name, type: file.type, lastModified: file.lastModified } : null,
    }))
  } catch { /* Draft recovery must never prevent normal editing or saving. */ }
}

export async function loadLearningLibraryDraft(key) {
  try {
    const record = await transact('readonly', store => store.get(key))
    if (record && Date.now() - record.savedAt <= MAX_AGE) {
      return { ...record, file: record.file?.blob ? new File([record.file.blob], record.file.name, { type: record.file.type, lastModified: record.file.lastModified }) : null }
    }
    if (record) await clearLearningLibraryDraft(key)
  } catch { /* Fall through to the session metadata when IndexedDB is unavailable. */ }
  return readLearningLibraryDraftMetadata(key)
}

export async function clearLearningLibraryDraft(key) {
  try { window.sessionStorage.removeItem(key) } catch { /* Ignore unavailable session storage. */ }
  try { await transact('readwrite', store => store.delete(key)) } catch { /* Ignore unavailable IndexedDB. */ }
}
