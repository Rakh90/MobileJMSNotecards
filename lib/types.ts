// Mirrors the subset of JMSNote's src/shared/types.ts this app actually needs — kept as a plain
// copy rather than a shared package for now, since it's small and changes rarely. If it drifts,
// the fix is "read the desktop app's types.ts again," not a build/publish step.
export type PropertyType = 'text' | 'number' | 'date' | 'select' | 'tags' | 'checkbox' | 'relation'

export interface PropertyDef {
  id: string
  name: string
  type: PropertyType
  options?: string[]
}

export interface DatabaseView {
  id: string
  name: string
  type: 'table' | 'kanban' | 'flashcards'
  groupBy?: string
}

export interface DatabaseRow {
  id: string
  properties: Record<string, unknown>
}

export interface DatabaseFile {
  id: string
  title: string
  folderId: string | null
  favorite: boolean
  order: number
  createdAt: string
  updatedAt: string
  properties: PropertyDef[]
  views: DatabaseView[]
  rows: DatabaseRow[]
  creditHours?: number
}
