import { getDriveAccessToken } from './googleDrive'
import type { DatabaseFile } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getDriveAccessToken()
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`)
  return res
}

async function findChildByName(parentId: string, name: string, mimeType?: string): Promise<string | null> {
  const q =
    `'${parentId}' in parents and name = '${name}' and trashed = false` +
    (mimeType ? ` and mimeType = '${mimeType}'` : '')
  const res = await authedFetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`)
  const data = (await res.json()) as { files: { id: string; name: string }[] }
  return data.files[0]?.id ?? null
}

// With full drive scope there's no need for the user to pick anything through a UI - the app can
// just search their whole Drive by name, the same way the desktop app's detectGoogleDriveRoot()
// finds things by a known path. Only top-level folders (not inside another folder) are matched,
// since that's where the desktop app creates the flashcards workspace.
export async function findFolderByName(name: string): Promise<string | null> {
  const q = `mimeType = '${FOLDER_MIME}' and name = '${name}' and trashed = false and 'root' in parents`
  const res = await authedFetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`)
  const data = (await res.json()) as { files: { id: string; name: string }[] }
  return data.files[0]?.id ?? null
}

export interface DriveDeckEntry {
  fileId: string
  file: DatabaseFile
}

// Mirrors lib/workspace.ts's SAF-based listFlashcardDecks: only the databases/ subfolder
// matters, and only .json files whose views include a flashcards view.
export async function listDriveDecks(workspaceFolderId: string): Promise<DriveDeckEntry[]> {
  const databasesId = await findChildByName(workspaceFolderId, 'databases', FOLDER_MIME)
  if (!databasesId) return []
  const q = `'${databasesId}' in parents and trashed = false and name contains '.json'`
  const res = await authedFetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`)
  const data = (await res.json()) as { files: { id: string; name: string }[] }

  const decks: DriveDeckEntry[] = []
  for (const f of data.files) {
    try {
      const file = await readDriveFile(f.id)
      if (file.views?.some((v) => v.type === 'flashcards')) decks.push({ fileId: f.id, file })
    } catch {
      // Skip a corrupt/unreadable file rather than failing the whole deck list over one bad row.
    }
  }
  return decks
}

export async function readDriveFile(fileId: string): Promise<DatabaseFile> {
  const res = await authedFetch(`${API}/files/${fileId}?alt=media`)
  return res.json()
}

export async function writeDriveFile(fileId: string, db: DatabaseFile): Promise<void> {
  const next: DatabaseFile = { ...db, updatedAt: new Date().toISOString() }
  await authedFetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next, null, 2)
  })
}
