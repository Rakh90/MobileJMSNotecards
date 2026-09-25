import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Theme } from '../lib/theme'
import { descendantFolderIds, type DeckFolder } from '../lib/deckFolders'
import type { DeckEntry } from '../lib/workspace'
import { MetalButton } from './Metal'
import FolderIcon from './FolderIcon'

export type StudyMode = 'due' | 'weak'
const UNGROUPED = '__ungrouped'

interface Node {
  id: string
  name: string
  depth: number
}

function buildNodes(folders: DeckFolder[], parentId: string | null, depth: number): Node[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .flatMap((f) => [{ id: f.id, name: f.name, depth }, ...buildNodes(folders, f.id, depth + 1)])
}

// Pick any mix of folders/subfolders (and, from the dashboard, decks that aren't in a folder) to
// study together. rootId limits the tree to one folder and everything under it.
export default function StudyPickerModal({
  visible,
  theme,
  folders,
  decks,
  assignments,
  rootId,
  onClose,
  onStart
}: {
  visible: boolean
  theme: Theme
  folders: DeckFolder[]
  decks: DeckEntry[]
  assignments: Record<string, string>
  rootId: string | null
  onClose: () => void
  onStart: (uris: string[], mode: StudyMode) => void
}) {
  const nodes = useMemo(() => {
    if (rootId) {
      const root = folders.find((f) => f.id === rootId)
      return root ? [{ id: root.id, name: root.name, depth: 0 }, ...buildNodes(folders, root.id, 1)] : []
    }
    return [{ id: UNGROUPED, name: 'Decks not in a folder', depth: 0 }, ...buildNodes(folders, null, 0)]
  }, [folders, rootId])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<StudyMode>('due')
  const styles = makeStyles(theme)

  useEffect(() => {
    if (visible) setSelected(new Set(nodes.map((n) => n.id)))
  }, [visible, nodes])

  function toggle(id: string): void {
    const ids = id === UNGROUPED ? [id] : [id, ...descendantFolderIds(folders, id)]
    const turnOff = selected.has(id)
    const next = new Set(selected)
    for (const i of ids) {
      if (turnOff) next.delete(i)
      else next.add(i)
    }
    setSelected(next)
  }

  const chosenUris = decks
    .filter((d) => selected.has(assignments[d.uri] ?? UNGROUPED))
    .map((d) => d.uri)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Study together</Text>
          <Text style={styles.sub}>Tick the folders and subfolders to mix into one session.</Text>

          <ScrollView style={{ maxHeight: 280 }}>
            {nodes.map((n) => {
              const on = selected.has(n.id)
              return (
                <Pressable key={n.id} style={[styles.row, { paddingLeft: 6 + n.depth * 20 }]} onPress={() => toggle(n.id)}>
                  <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.tick}>✓</Text>}</View>
                  {n.id !== UNGROUPED && <FolderIcon color={theme.accent} size={16} />}
                  <Text style={styles.rowText} numberOfLines={1}>
                    {n.name}
                  </Text>
                </Pressable>
              )
            })}
            {nodes.length === 0 && <Text style={styles.sub}>No folders yet.</Text>}
          </ScrollView>

          <View style={styles.modeRow}>
            {(['due', 'weak'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.chip, mode === m && { borderColor: theme.accent, backgroundColor: theme.bgActive }]}
              >
                <Text style={{ color: mode === m ? theme.accent : theme.textMuted, fontWeight: mode === m ? '600' : '400', fontSize: 13 }}>
                  {m === 'due' ? 'Due cards' : 'Weak cards'}
                </Text>
              </Pressable>
            ))}
          </View>

          <MetalButton
            label={`Start · ${chosenUris.length} deck${chosenUris.length === 1 ? '' : 's'}`}
            colors={theme.btnGrad}
            onPress={() => chosenUris.length > 0 && onStart(chosenUris, mode)}
            style={{ marginTop: 14, opacity: chosenUris.length > 0 ? 1 : 0.5 }}
          />
          <Pressable style={{ alignItems: 'center', marginTop: 12 }} onPress={onClose}>
            <Text style={{ color: theme.accent, fontSize: 13.5, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: {
      backgroundColor: theme.bgAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      width: '100%',
      maxWidth: 380
    },
    title: { fontSize: 16, fontWeight: '700', color: theme.text },
    sub: { fontSize: 12.5, color: theme.textMuted, marginTop: 4, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingRight: 6 },
    box: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: theme.borderAccent,
      alignItems: 'center',
      justifyContent: 'center'
    },
    boxOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    tick: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: -1 },
    rowText: { flex: 1, color: theme.text, fontSize: 14.5 },
    modeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }
  })
}
