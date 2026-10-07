import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NoteFolder } from './notes'

// Notes and their folders belong to the desktop app and are read-only here. This is the phone's
// own re-arranging of a class's folders: for each folder that was moved, which folder it now sits
// in (null = top level). It never changes anything on Drive or on the PC, and a moved folder can
// be put back to where the desktop has it.
const KEY = 'jmsnote.noteFolderMoves'

type Moves = Record<string, Record<string, string | null>>

async function loadAll(): Promise<Moves> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export async function loadMoves(courseId: string): Promise<Record<string, string | null>> {
  return (await loadAll())[courseId] ?? {}
}

export async function setFolderMove(courseId: string, folderId: string, parentId: string | null): Promise<void> {
  const all = await loadAll()
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [courseId]: { ...(all[courseId] ?? {}), [folderId]: parentId } }))
}

export async function clearFolderMove(courseId: string, folderId: string): Promise<void> {
  const all = await loadAll()
  const mine = { ...(all[courseId] ?? {}) }
  delete mine[folderId]
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [courseId]: mine }))
}

// The class's folders with the phone's moves applied. A move is ignored if its target folder no
// longer exists (the desktop deleted it), so a folder can never end up unreachable.
export function applyMoves(folders: NoteFolder[], moves: Record<string, string | null>): NoteFolder[] {
  const ids = new Set(folders.map((f) => f.id))
  return folders.map((f) => {
    if (!(f.id in moves)) return f
    const target = moves[f.id]
    if (target !== null && !ids.has(target)) return f
    return { ...f, parentId: target }
  })
}
