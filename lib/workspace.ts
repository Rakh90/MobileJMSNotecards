import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DatabaseFile } from './types'
import { listDriveDecks, readDriveFile, writeDriveFile } from './driveApi'

const { StorageAccessFramework } = FileSystem
const STORAGE_KEY = 'jmsnote.workspaceUri'

// A workspace picked via Google's Drive Picker (see components/DrivePickerModal.tsx) is stored
// with this prefix instead of a real content:// SAF uri, since Expo's SAF module hard-rejects
// any provider other than Android's built-in local-storage one (see lib/driveApi.ts). Every
// function below branches on this prefix so callers (app/index.tsx, study/quiz screens) never
// need to know which backend a given deck actually lives in.
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
export async function listFlashcardDecks(workspaceUri: string): Promise<DeckEntry[]> {
  if (workspaceUri.startsWith(DRIVE_PREFIX)) {
    const folderId = workspaceUri.slice(DRIVE_PREFIX.length)
    const entries = await listDriveDecks(folderId)
    return entries.map((e) => ({ uri: DRIVE_PREFIX + e.fileId, file: e.file }))
  }
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
  if (uri.startsWith(DRIVE_PREFIX)) return readDriveFile(uri.slice(DRIVE_PREFIX.length))
  const raw = await StorageAccessFramework.readAsStringAsync(uri)
  return JSON.parse(raw)
}

export async function writeDeckFile(uri: string, db: DatabaseFile): Promise<void> {
  if (uri.startsWith(DRIVE_PREFIX)) return writeDriveFile(uri.slice(DRIVE_PREFIX.length), db)
  const next: DatabaseFile = { ...db, updatedAt: new Date().toISOString() }
  await StorageAccessFramework.writeAsStringAsync(uri, JSON.stringify(next, null, 2))
}
