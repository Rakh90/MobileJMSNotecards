import AsyncStorage from '@react-native-async-storage/async-storage'

// Purely a phone-side organizational layer - it never touches the actual deck files or their
// location (local folder or Drive), just groups deck URIs into named buckets for the dashboard.
// A deck is looked up by its `uri` (the same value used as its list key elsewhere), which is
// stable for as long as the underlying file exists.
export interface DeckFolder {
  id: string
  name: string
}

const FOLDERS_KEY = 'jmsnote.deckFolders'
const ASSIGNMENTS_KEY = 'jmsnote.deckFolderAssignments'

export async function loadFolders(): Promise<DeckFolder[]> {
  const raw = await AsyncStorage.getItem(FOLDERS_KEY)
  return raw ? JSON.parse(raw) : []
}

async function saveFolders(folders: DeckFolder[]): Promise<void> {
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export async function createFolder(name: string): Promise<DeckFolder> {
  const folders = await loadFolders()
  const folder: DeckFolder = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, name }
  await saveFolders([...folders, folder])
  return folder
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const folders = await loadFolders()
  await saveFolders(folders.map((f) => (f.id === id ? { ...f, name } : f)))
}

export async function deleteFolder(id: string): Promise<void> {
  const folders = await loadFolders()
  await saveFolders(folders.filter((f) => f.id !== id))
  const assignments = await loadAssignments()
  const next = { ...assignments }
  for (const key of Object.keys(next)) if (next[key] === id) delete next[key]
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
