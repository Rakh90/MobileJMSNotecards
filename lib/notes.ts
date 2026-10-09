import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  findFolderByName,
  listChildren,
  findChildId,
  readDriveText,
  driveMediaRequest
} from './driveApi'

// Read-only access to notes kept in Google Drive. Layout on Drive (written by the desktop app):
//   JMSNote Courses/<Course>/{notes/<id>.md, attachments/*, index.json, folders.json}
// Each folder inside "JMSNote Courses" is one class (a desktop workspace). Everything read from
// Drive is copied to the phone so a class opens offline; a copy is refreshed whenever the file's
// Drive modified time changes.

export const COURSES_FOLDER_NAME = 'JMSNote Courses'

export interface Course {
  id: string
  name: string
}

export interface NoteFolder {
  id: string
  name: string
  parentId: string | null
  order: number
}

export interface NoteSummary {
  id: string
  title: string
  folderId: string | null
  tags: string[]
  order: number
  updatedAt: string
}

export interface CourseData {
  folders: NoteFolder[]
  notes: NoteSummary[]
  // note id -> where its markdown lives on Drive
  noteFiles: Record<string, { fileId: string; modifiedTime: string; size?: number }>
  // attachment file name -> Drive file id
  attachments: Record<string, string>
  fetchedAt: string
}

const DIR = `${FileSystem.documentDirectory}notes/`
const COURSES_KEY = 'jmsnote.notes.courses'
const CONTENT_META_KEY = 'jmsnote.notes.contentMeta'

function flat(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, '_')
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true })
}

// ---------- courses ----------

export async function listCourses(): Promise<{ courses: Course[]; offline: boolean; missingFolder: boolean }> {
  try {
    const rootId = await findFolderByName(COURSES_FOLDER_NAME)
    if (!rootId) return { courses: [], offline: false, missingFolder: true }
    const kids = await listChildren(rootId, true)
    const courses = kids.map((k) => ({ id: k.id, name: k.name })).sort((a, b) => a.name.localeCompare(b.name))
    AsyncStorage.setItem(COURSES_KEY, JSON.stringify(courses)).catch(() => {})
    return { courses, offline: false, missingFolder: false }
  } catch (err) {
    const raw = await AsyncStorage.getItem(COURSES_KEY)
    if (!raw) throw err
    return { courses: JSON.parse(raw) as Course[], offline: true, missingFolder: false }
  }
}

// ---------- one course's folders + note list ----------

export interface Frontmatter {
  title?: string
  tags?: string[]
  body: string
}

function unquote(v: string): string {
  const t = v.trim()
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'")
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    try {
      return JSON.parse(t)
    } catch {
      return t.slice(1, -1)
    }
  }
  return t
}

// Notes are markdown with a small YAML header (title, tags, ...). Only the title and tags matter
// here, so this reads those two keys rather than pulling in a YAML parser.
export function splitFrontmatter(raw: string): Frontmatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!m) return { body: raw }
  const header = m[1]
  const title = /^title:\s*(.*)$/m.exec(header)
  const result: Frontmatter = { body: raw.slice(m[0].length) }
  if (title) result.title = unquote(title[1])
  const inline = /^tags:\s*\[(.*)\]\s*$/m.exec(header)
  if (inline) {
    result.tags = inline[1]
      .split(',')
      .map((t) => unquote(t))
      .filter(Boolean)
  } else {
    const block = /^tags:\s*\r?\n((?:\s*-\s*.*\r?\n?)+)/m.exec(header)
    if (block) {
      result.tags = block[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*-\s*/, ''))
        .filter(Boolean)
        .map(unquote)
    }
  }
  return result
}

async function readJson<T>(parentId: string, name: string): Promise<T | null> {
  const id = await findChildId(parentId, name)
  if (!id) return null
  try {
    return JSON.parse(await readDriveText(id)) as T
  } catch {
    return null
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

async function fetchCourse(courseId: string): Promise<CourseData> {
  const notesDirId = await findChildId(courseId, 'notes', true)
  const attDirId = await findChildId(courseId, 'attachments', true)
  const noteFiles: CourseData['noteFiles'] = {}
  if (notesDirId) {
    for (const f of await listChildren(notesDirId)) {
      if (f.name.endsWith('.md')) noteFiles[f.name.slice(0, -3)] = { fileId: f.id, modifiedTime: f.modifiedTime, size: f.size ? Number(f.size) : undefined }
    }
  }
  const attachments: CourseData['attachments'] = {}
  if (attDirId) for (const f of await listChildren(attDirId)) attachments[f.name] = f.id

  // index.json already holds every note's title/folder/tags, so the list normally costs a single
  // request instead of opening each note.
  const index = await readJson<{ folders?: NoteFolder[]; notes?: NoteSummary[] }>(courseId, 'index.json')
  let folders: NoteFolder[] = []
  let notes: NoteSummary[] = []
  if (index?.notes) {
    folders = (index.folders ?? []).map((f, i) => ({ ...f, order: f.order ?? i }))
    notes = index.notes
      .filter((n) => noteFiles[n.id])
      .map((n) => ({
        id: n.id,
        title: n.title || 'Untitled',
        folderId: n.folderId ?? null,
        tags: n.tags ?? [],
        order: n.order ?? 0,
        updatedAt: n.updatedAt ?? ''
      }))
  } else {
    folders = ((await readJson<NoteFolder[]>(courseId, 'folders.json')) ?? []).map((f, i) => ({ ...f, order: f.order ?? i }))
    const ids = Object.keys(noteFiles)
    notes = await mapLimit(ids, 4, async (id) => {
      const fm = splitFrontmatter(await readDriveText(noteFiles[id].fileId))
      return { id, title: fm.title || 'Untitled', folderId: null, tags: fm.tags ?? [], order: 0, updatedAt: noteFiles[id].modifiedTime }
    })
  }
  return { folders, notes, noteFiles, attachments, fetchedAt: new Date().toISOString() }
}

export async function loadCourse(courseId: string): Promise<{ data: CourseData; offline: boolean }> {
  try {
    const data = await fetchCourse(courseId)
    try {
      await ensureDir()
      await FileSystem.writeAsStringAsync(`${DIR}course_${flat(courseId)}.json`, JSON.stringify(data))
    } catch {
      // best effort
    }
    return { data, offline: false }
  } catch (err) {
    const cached = await readCachedCourse(courseId)
    if (cached) return { data: cached, offline: true }
    throw err
  }
}

export async function readCachedCourse(courseId: string): Promise<CourseData | null> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(`${DIR}course_${flat(courseId)}.json`))
  } catch {
    return null
  }
}

// ---------- note content ----------

async function loadContentMeta(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(CONTENT_META_KEY)
  return raw ? JSON.parse(raw) : {}
}

export interface NoteContent {
  title: string
  body: string
  stale: boolean
}

// Length of a string once saved as UTF-8 - compared with the size Drive reports for the file, to
// catch a note that arrived incomplete.
function utf8Length(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4
      i++
    } else n += 3
  }
  return n
}

const isComplete = (text: string, size?: number): boolean => size === undefined || utf8Length(text) === size

// Reads a note from Drive. If what arrived isn't the size Drive says the file is, it is fetched
// again by downloading straight to a file instead.
async function fetchNoteText(file: { fileId: string; size?: number }, path: string): Promise<string> {
  let text = await readDriveText(file.fileId)
  if (!isComplete(text, file.size)) {
    try {
      await ensureDir()
      const { url, headers } = await driveMediaRequest(file.fileId)
      const res = await FileSystem.downloadAsync(url, path, { headers })
      if (res.status === 200) text = await FileSystem.readAsStringAsync(path)
    } catch {
      // keep what we have
    }
  }
  return text
}

export async function readNote(data: CourseData, noteId: string): Promise<NoteContent> {
  const file = data.noteFiles[noteId]
  if (!file) throw new Error('That note is no longer on Drive.')
  const path = `${DIR}note_${flat(file.fileId)}.md`
  const meta = await loadContentMeta()
  const haveCurrent = meta[file.fileId] === file.modifiedTime
  let raw: string | null = null
  if (haveCurrent) {
    try {
      raw = await FileSystem.readAsStringAsync(path)
      // A saved copy that is the wrong size (e.g. cut short) is thrown away and fetched again.
      if (!isComplete(raw, file.size)) raw = null
    } catch {
      raw = null
    }
  }
  let stale = false
  if (raw === null) {
    try {
      raw = await fetchNoteText(file, path)
      try {
        await ensureDir()
        await FileSystem.writeAsStringAsync(path, raw)
        meta[file.fileId] = file.modifiedTime
        await AsyncStorage.setItem(CONTENT_META_KEY, JSON.stringify(meta))
      } catch {
        // caching is best effort
      }
    } catch (err) {
      try {
        raw = await FileSystem.readAsStringAsync(path)
        stale = true
      } catch {
        throw err
      }
    }
  }
  const fm = splitFrontmatter(raw)
  const summary = data.notes.find((n) => n.id === noteId)
  return { title: fm.title || summary?.title || 'Untitled', body: fm.body, stale }
}

// ---------- images ----------

const imageJobs = new Map<string, Promise<string | null>>()

// Notes reference images as ../attachments/<file>. Returns a local file uri once the image has
// been copied to the phone (downloading it the first time), or null if it can't be found.
export function localAttachment(data: CourseData, fileName: string): Promise<string | null> {
  const id = data.attachments[fileName]
  if (!id) return Promise.resolve(null)
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(fileName)?.[0] ?? ''
  const dest = `${DIR}att_${flat(id)}${ext}`
  let job = imageJobs.get(dest)
  if (!job) {
    job = (async () => {
      try {
        await ensureDir()
        const info = await FileSystem.getInfoAsync(dest)
        if (info.exists) return dest
        const { url, headers } = await driveMediaRequest(id)
        const res = await FileSystem.downloadAsync(url, dest, { headers })
        if (res.status !== 200) {
          await FileSystem.deleteAsync(dest, { idempotent: true })
          return null
        }
        return dest
      } catch {
        return null
      }
    })().finally(() => imageJobs.delete(dest))
    imageJobs.set(dest, job)
  }
  return job
}

export function attachmentName(src: string): string | null {
  const m = /attachments\/([^)\s?#]+)/.exec(src)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

// ---------- offline download ----------

// Copies every note in the course (and the images they use) to the phone.
export async function downloadCourse(
  data: CourseData,
  onProgress?: (done: number, total: number) => void
): Promise<{ notes: number; failed: number }> {
  const ids = data.notes.map((n) => n.id)
  let done = 0
  let failed = 0
  const images = new Set<string>()
  await mapLimit(ids, 4, async (id) => {
    try {
      const n = await readNote(data, id)
      if (n.stale) failed++
      for (const m of n.body.matchAll(/\]\(([^)]*attachments\/[^)\s]+)/g)) {
        const name = attachmentName(m[1])
        if (name) images.add(name)
      }
    } catch {
      failed++
    }
    onProgress?.(++done, ids.length + 0)
  })
  await mapLimit([...images], 4, (name) => localAttachment(data, name))
  return { notes: ids.length - failed, failed }
}
