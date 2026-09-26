import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DatabaseFile } from './types'
import { listDriveDecks, readDriveFile, writeDriveFile } from './driveApi'
import {
  readCached,
  writeCached,
  isDirty,
  markClean,
  dirtyUris,
  saveDeckList,
  loadDeckList,
  mergeProgress
} from './offlineCache'

const { StorageAccessFramework } = FileSystem
const STORAGE_KEY = 'jmsnote.workspaceUri'

// A workspace connected via Google Drive (see lib/googleDrive.ts, lib/driveApi.ts) is stored
// with this prefix instead of a real content:// SAF uri, since Expo's SAF module hard-rejects
// any provider other than Android's built-in local-storage one. Every function below branches
// on this prefix so callers (app/index.tsx, study/quiz screens) never need to know which
// backend a given deck actually lives in.
export const DRIVE_PREFIX = 'gdrive://'

// SAF's readDirectoryAsync only ever returns raw content:// URIs, no name/type metadata — the
// document's own name is the last path segment once decoded, which is what lets us find the
// "databases" subfolder by name and tell .json files apart from everything else.
function entryName(uri: string): string {
  const decoded = decodeURIComponent(uri)
  const parts = decoded.split('/')
  return parts[parts.length - 1] || ''
}

export async function saveWorkspaceUri(uri: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, uri)
}

export async function loadWorkspaceUri(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY)
}

export async function clearWorkspaceUri(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

// Opens Android's system folder picker. The permission this grants is persistent (Android keeps
// it across app restarts and even reinstalls tied to the same URI) as long as we hold onto the
// returned URI ourselves — hence saving it immediately.
export async function pickWorkspaceFolder(): Promise<string | null> {
  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync()
  if (!result.granted) return null
  await saveWorkspaceUri(result.directoryUri)
  return result.directoryUri
}

async function findChildByName(dirUri: string, name: string): Promise<string | null> {
  const children = await StorageAccessFramework.readDirectoryAsync(dirUri)
  return children.find((c) => entryName(c) === name) ?? null
}

export interface DeckEntry {
  uri: string
  file: DatabaseFile
}

// A workspace root looks like notes/, databases/, attachments/, etc. (see the desktop app's
// main/workspace.ts) — only databases/ matters here, and only the ones with a flashcards view.
// Pushes any study progress that was saved offline up to Drive, merging per card (newest grade
// wins). Anything that fails stays queued for the next attempt.
// Drive saves in flight, one queue per deck. Saving a deck on every graded card can start a new
// write before the last one has finished; letting them race meant an older snapshot could land
// last and undo newer progress. Instead each deck keeps only its newest snapshot and writes them
// strictly one at a time.
const writers = new Map<string, { latest: DatabaseFile | null; running: Promise<void> | null }>()

async function queueDriveWrite(uri: string, db: DatabaseFile): Promise<void> {
  let w = writers.get(uri)
  if (!w) {
    w = { latest: null, running: null }
    writers.set(uri, w)
  }
  w.latest = db
  const state = w
  if (!state.running) {
    state.running = (async () => {
      while (state.latest) {
        const snapshot = state.latest
        state.latest = null
        try {
          await writeDriveFile(uri.slice(DRIVE_PREFIX.length), snapshot)
          // Only clear the "unsynced" flag if nothing newer arrived while this write was going.
          if (!state.latest) await markClean(uri)
        } catch {
          state.latest = null // offline: leave it flagged for syncPending() to retry later
          break
        }
      }
      state.running = null
    })()
  }
  await state.running
}

export async function syncPending(): Promise<void> {
  for (const uri of await dirtyUris()) {
    if (writers.get(uri)?.running) continue
    try {
      const local = await readCached(uri)
      if (!local) {
        await markClean(uri)
        continue
      }
      const remote = await readDriveFile(uri.slice(DRIVE_PREFIX.length))
      const merged = mergeProgress(remote, local)
      await writeDriveFile(uri.slice(DRIVE_PREFIX.length), merged)
      await writeCached(uri, merged, false)
    } catch {
      // still offline (or Drive is unhappy) - leave it queued
    }
  }
}

export async function pendingCount(): Promise<number> {
  return (await dirtyUris()).length
}

export interface DeckListResult {
  decks: DeckEntry[]
  offline: boolean
}

// Same as listFlashcardDecks, but says whether the result came from saved local copies because
// Drive couldn't be reached. Successful Drive reads refresh the local copies as a side effect,
// which is also what the manual "Download for offline" action relies on.
export async function listFlashcardDecksWithStatus(workspaceUri: string): Promise<DeckListResult> {
  if (!workspaceUri.startsWith(DRIVE_PREFIX)) return { decks: await listFlashcardDecks(workspaceUri), offline: false }
  const folderId = workspaceUri.slice(DRIVE_PREFIX.length)
  try {
    await syncPending()
    const entries = await listDriveDecks(folderId)
    // A deck whose latest progress hasn't reached Drive yet (still saving, or saved offline) is
    // shown from the local copy merged over Drive's, so leaving a study session never makes the
    // list flash back to older numbers.
    const decks: DeckEntry[] = []
    for (const e of entries) {
      const u = DRIVE_PREFIX + e.fileId
      let file = e.file
      if (await isDirty(u)) {
        const local = await readCached(u)
        if (local) file = mergeProgress(file, local)
      }
      decks.push({ uri: u, file })
    }
    // Caching is best-effort: a failure here must never stop the live deck list from showing.
    try {
      for (const d of decks) if (!(await isDirty(d.uri))) await writeCached(d.uri, d.file, false)
      await saveDeckList(workspaceUri, decks.map((d) => d.uri))
    } catch {
      // ignore
    }
    return { decks, offline: false }
  } catch (err) {
    const uris = await loadDeckList(workspaceUri)
    if (!uris) throw err
    const decks: DeckEntry[] = []
    for (const uri of uris) {
      const file = await readCached(uri)
      if (file) decks.push({ uri, file })
    }
    return { decks, offline: true }
  }
}

export async function listFlashcardDecks(workspaceUri: string): Promise<DeckEntry[]> {
  if (workspaceUri.startsWith(DRIVE_PREFIX)) return (await listFlashcardDecksWithStatus(workspaceUri)).decks
  const databasesUri = await findChildByName(workspaceUri, 'databases')
  if (!databasesUri) return []
  const children = await StorageAccessFramework.readDirectoryAsync(databasesUri)
  const jsonUris = children.filter((c) => entryName(c).toLowerCase().endsWith('.json'))

  const decks: DeckEntry[] = []
  for (const uri of jsonUris) {
    try {
      const raw = await StorageAccessFramework.readAsStringAsync(uri)
      const file = JSON.parse(raw) as DatabaseFile
      if (file.views?.some((v) => v.type === 'flashcards')) decks.push({ uri, file })
    } catch {
      // Skip a corrupt/unreadable file rather than failing the whole deck list over one bad row.
    }
  }
  return decks
}

export async function readDeckFile(uri: string): Promise<DatabaseFile> {
  if (uri.startsWith(DRIVE_PREFIX)) {
    // A deck with unsynced offline progress is the source of truth until it's been pushed.
    if (await isDirty(uri)) {
      const cached = await readCached(uri)
      if (cached) return cached
    }
    try {
      const file = await readDriveFile(uri.slice(DRIVE_PREFIX.length))
      writeCached(uri, file, false).catch(() => {})
      return file
    } catch (err) {
      const cached = await readCached(uri)
      if (cached) return cached
      throw err
    }
  }
  const raw = await StorageAccessFramework.readAsStringAsync(uri)
  return JSON.parse(raw)
}

export async function writeDeckFile(uri: string, db: DatabaseFile): Promise<void> {
  if (uri.startsWith(DRIVE_PREFIX)) {
    // Save locally first and flag it, so progress survives being offline; only clear the flag
    // once Drive has actually accepted it.
    await writeCached(uri, db, true).catch(() => {})
    await queueDriveWrite(uri, db)
    return
  }
  const next: DatabaseFile = { ...db, updatedAt: new Date().toISOString() }
  // Same idea as the Drive queue: chain each local write after the previous one for this file.
  const previous = localWrites.get(uri) ?? Promise.resolve()
  const run = previous
    .catch(() => {})
    .then(() => StorageAccessFramework.writeAsStringAsync(uri, JSON.stringify(next, null, 2)))
  localWrites.set(uri, run)
  await run
}
const localWrites = new Map<string, Promise<void>>()
