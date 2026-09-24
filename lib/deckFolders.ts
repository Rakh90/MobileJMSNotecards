import AsyncStorage from '@react-native-async-storage/async-storage'

// Purely a phone-side organizational layer - it never touches the actual deck files or their
// location (local folder or Drive), just groups deck URIs into named buckets for the dashboard.
// A deck is looked up by its `uri` (the same value used as its list key elsewhere), which is
// stable for as long as the underlying file exists. Folders can nest via parentId (null = a
// top-level folder), to arbitrary depth. Deleting a folder soft-deletes it (deletedAt) rather
// than dropping it immediately, so it can be restored from the trash screen; assignments are
// left untouched by a soft delete, only cleared by a permanent one.
export interface DeckFolder {
  id: string
  name: string
  parentId: string | null
  deletedAt: string | null
}

const FOLDERS_KEY = 'jmsnote.deckFolders'
const ASSIGNMENTS_KEY = 'jmsnote.deckFolderAssignments'

async function loadAllFolders(): Promise<DeckFolder[]> {
  const raw = await AsyncStorage.getItem(FOLDERS_KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw) as Partial<DeckFolder>[]
  // Defensive: drop anything that ended up with no real name (e.g. from an earlier bug, or a
  // race where a create was interrupted) rather than rendering a blank, unselectable row.
  return parsed
    .filter((f): f is DeckFolder => typeof f.id === 'string' && typeof f.name === 'string' && f.name.trim() !== '')
    .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId ?? null, deletedAt: f.deletedAt ?? null }))
}

export async function loadFolders(): Promise<DeckFolder[]> {
  return (await loadAllFolders()).filter((f) => !f.deletedAt)
}

export async function loadTrashedFolders(): Promise<DeckFolder[]> {
  return (await loadAllFolders()).filter((f) => !!f.deletedAt)
}

async function saveFolders(folders: DeckFolder[]): Promise<void> {
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export async function createFolder(name: string, parentId: string | null = null): Promise<DeckFolder> {
  const trimmed = name.trim()
  const folders = await loadAllFolders()
  const folder: DeckFolder = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    parentId,
    deletedAt: null
  }
  await saveFolders([...folders, folder])
  return folder
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const folders = await loadAllFolders()
  await saveFolders(folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)))
}

// All folder ids nested (at any depth) inside rootId - used to cascade trash/restore/permanent
// delete across a subtree, and to let a folder's deck count / search include subfolder decks.
export function descendantFolderIds(folders: DeckFolder[], rootId: string): string[] {
  const children = folders.filter((f) => f.parentId === rootId).map((f) => f.id)
  return children.concat(...children.map((id) => descendantFolderIds(folders, id)))
}

function ancestorFolderIds(folders: DeckFolder[], id: string): string[] {
  const folder = folders.find((f) => f.id === id)
  if (!folder || folder.parentId === null) return []
  return [folder.parentId, ...ancestorFolderIds(folders, folder.parentId)]
}

// Soft delete: the folder and its whole subtree move to the trash together. Deck assignments
// are left alone, so restoring puts everything back exactly as it was.
export async function trashFolder(id: string): Promise<void> {
  const all = await loadAllFolders()
  const ids = new Set([id, ...descendantFolderIds(all, id)])
  const now = new Date().toISOString()
  await saveFolders(all.map((f) => (ids.has(f.id) ? { ...f, deletedAt: now } : f)))
}

// Restores the folder, its subtree (so a whole trashed branch comes back together), and any
// trashed ancestors (so it's never left orphaned under a still-trashed parent, unreachable from
// the normal folder tree).
export async function restoreFolder(id: string): Promise<void> {
  const all = await loadAllFolders()
  const ids = new Set([id, ...descendantFolderIds(all, id), ...ancestorFolderIds(all, id)])
  await saveFolders(all.map((f) => (ids.has(f.id) ? { ...f, deletedAt: null } : f)))
}

// Permanently removes the folder and its subtree, and unassigns (not deletes) any decks that
// were inside it - the deck files themselves are never touched by anything in this module.
export async function permanentlyDeleteFolder(id: string): Promise<void> {
  const all = await loadAllFolders()
  const ids = new Set([id, ...descendantFolderIds(all, id)])
  await saveFolders(all.filter((f) => !ids.has(f.id)))
  const assignments = await loadAssignments()
  const next = { ...assignments }
  for (const key of Object.keys(next)) if (ids.has(next[key])) delete next[key]
  await saveAssignments(next)
}

export async function loadAssignments(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(ASSIGNMENTS_KEY)
  return raw ? JSON.parse(raw) : {}
}

async function saveAssignments(assignments: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments))
}

export async function setDeckFolder(deckUri: string, folderId: string | null): Promise<void> {
  const assignments = await loadAssignments()
  const next = { ...assignments }
  if (folderId) next[deckUri] = folderId
  else delete next[deckUri]
  await saveAssignments(next)
}
