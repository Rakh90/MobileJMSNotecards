import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SRS_DUE_KEY, SRS_EASE_KEY, SRS_INTERVAL_KEY, SRS_CORRECT_KEY, SRS_INCORRECT_KEY, SRS_LAST_KEY } from './srs'
import type { DatabaseFile } from './types'

// Local copies of Drive decks, so the app opens and can be studied without a connection.
// Each deck lives in its own file under documentDirectory/offline/. `dirty` decks hold study
// progress that hasn't reached Drive yet; syncing merges it in per card, keeping whichever side
// graded that card most recently, so studying offline never overwrites progress made elsewhere.
const DIR = `${FileSystem.documentDirectory}offline/`
const INDEX_KEY = 'jmsnote.offline.index'
const LISTS_KEY = 'jmsnote.offline.lists'

interface IndexEntry {
  dirty: boolean
  cachedAt: string
}

async function loadIndex(): Promise<Record<string, IndexEntry>> {
  const raw = await AsyncStorage.getItem(INDEX_KEY)
  return raw ? JSON.parse(raw) : {}
}

async function saveIndex(index: Record<string, IndexEntry>): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

function fileFor(uri: string): string {
  return `${DIR}${encodeURIComponent(uri)}.json`
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true })
}

export async function readCached(uri: string): Promise<DatabaseFile | null> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(fileFor(uri)))
  } catch {
    return null
  }
}

export async function writeCached(uri: string, db: DatabaseFile, dirty: boolean): Promise<void> {
  await ensureDir()
  await FileSystem.writeAsStringAsync(fileFor(uri), JSON.stringify(db))
  const index = await loadIndex()
  index[uri] = { dirty, cachedAt: new Date().toISOString() }
  await saveIndex(index)
}

export async function isDirty(uri: string): Promise<boolean> {
  return !!(await loadIndex())[uri]?.dirty
}

export async function markClean(uri: string): Promise<void> {
  const index = await loadIndex()
  if (index[uri]) index[uri].dirty = false
  await saveIndex(index)
}

export async function dirtyUris(): Promise<string[]> {
  const index = await loadIndex()
  return Object.keys(index).filter((u) => index[u].dirty)
}

export async function saveDeckList(workspaceUri: string, uris: string[]): Promise<void> {
  const raw = await AsyncStorage.getItem(LISTS_KEY)
  const all = raw ? JSON.parse(raw) : {}
  all[workspaceUri] = uris
  await AsyncStorage.setItem(LISTS_KEY, JSON.stringify(all))
}

export async function loadDeckList(workspaceUri: string): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(LISTS_KEY)
  const all = raw ? JSON.parse(raw) : {}
  return all[workspaceUri] ?? null
}

const SRS_KEYS = [SRS_DUE_KEY, SRS_EASE_KEY, SRS_INTERVAL_KEY, SRS_CORRECT_KEY, SRS_INCORRECT_KEY, SRS_LAST_KEY]

// Takes the remote deck as the base (so card edits made elsewhere are kept) and, for every card
// the local copy graded more recently than the remote did, copies over just its study progress.
export function mergeProgress(remote: DatabaseFile, local: DatabaseFile): DatabaseFile {
  const localById = new Map(local.rows.map((r) => [r.id, r]))
  const rows = remote.rows.map((r) => {
    const l = localById.get(r.id)
    if (!l) return r
    const localAt = String(l.properties[SRS_LAST_KEY] ?? '')
    const remoteAt = String(r.properties[SRS_LAST_KEY] ?? '')
    if (localAt <= remoteAt) return r
    const properties = { ...r.properties }
    for (const k of SRS_KEYS) if (k in l.properties) properties[k] = l.properties[k]
    return { ...r, properties }
  })
  return { ...remote, rows }
}
