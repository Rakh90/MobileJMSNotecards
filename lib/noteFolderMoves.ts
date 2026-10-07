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

// ---------- order ----------

// The phone's own order for the folders inside one parent (null parent = the class's top level).
const ORDER_KEY = 'jmsnote.noteFolderOrder'
type Orders = Record<string, Record<string, string[]>>

async function loadOrders(): Promise<Orders> {
  try {
    const raw = await AsyncStorage.getItem(ORDER_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const parentKey = (parentId: string | null): string => parentId ?? '__root'

export async function loadOrder(courseId: string): Promise<Record<string, string[]>> {
  return (await loadOrders())[courseId] ?? {}
}

export async function saveOrder(courseId: string, parentId: string | null, ids: string[]): Promise<void> {
  const all = await loadOrders()
  await AsyncStorage.setItem(
    ORDER_KEY,
    JSON.stringify({ ...all, [courseId]: { ...(all[courseId] ?? {}), [parentKey(parentId)]: ids } })
  )
}

// Sorts one parent's folders: ones the phone has an order for come first, in that order; any
// others (new folders from the desktop) follow in the desktop's own order.
export function sortFolders(
  siblings: NoteFolder[],
  parentId: string | null,
  orders: Record<string, string[]>
): NoteFolder[] {
  const saved = orders[parentKey(parentId)] ?? []
  const base = [...siblings].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const rank = (id: string): number => {
    const i = saved.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return base.sort((a, b) => rank(a.id) - rank(b.id))
}
