import { useState } from 'react'
import { Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native'
import type { Theme } from '../lib/theme'
import type { DeckFolder } from '../lib/deckFolders'
import FolderIcon from './FolderIcon'

interface FlatFolder {
  folder: DeckFolder
  depth: number
}

function flatten(folders: DeckFolder[], parentId: string | null = null, depth = 0): FlatFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .flatMap((f) => [{ folder: f, depth }, ...flatten(folders, f.id, depth + 1)])
}

function pathLabel(folders: DeckFolder[], id: string | null): string {
  const parts: string[] = []
  let cur = id ? folders.find((f) => f.id === id) : undefined
  while (cur) {
    parts.unshift(cur.name)
    const parent: string | null = cur.parentId
    cur = parent ? folders.find((f) => f.id === parent) : undefined
  }
  return parts.length ? parts.join(' › ') : 'No folder'
}

export default function MoveToFolderModal({
  deckTitle,
  folders,
  currentFolderId,
  theme,
  onAssign,
  onCreateAndAssign,
  onClose
}: {
  deckTitle: string | null
  folders: DeckFolder[]
  currentFolderId: string | null
  theme: Theme
  onAssign: (folderId: string | null) => void
  onCreateAndAssign: (name: string) => void
  onClose: () => void
}) {
  const [newFolderName, setNewFolderName] = useState('')
  const [open, setOpen] = useState(false)
  const styles = makeStyles(theme)

  if (deckTitle === null) return null

  function submitNewFolder(): void {
    const name = newFolderName.trim()
    if (!name) return
    onCreateAndAssign(name)
    setNewFolderName('')
  }

  function choose(id: string | null): void {
    setOpen(false)
    onAssign(id)
  }

  function close(): void {
    setOpen(false)
    onClose()
  }

  const flat = flatten(folders)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Move "{deckTitle}" to…</Text>

          <Pressable style={styles.select} onPress={() => setOpen((o) => !o)}>
            <FolderIcon color={theme.accent} size={18} />
            <Text style={styles.selectText} numberOfLines={1}>
              {pathLabel(folders, currentFolderId)}
            </Text>
            <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
          </Pressable>

          {open && (
            <View style={styles.menu}>
              <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                <Pressable style={styles.option} onPress={() => choose(null)}>
                  <Text style={[styles.optionText, currentFolderId === null && styles.optionTextActive]}>No folder</Text>
                  {currentFolderId === null && <Text style={styles.check}>✓</Text>}
                </Pressable>
                {flat.map(({ folder, depth }) => (
                  <Pressable
                    key={folder.id}
                    style={[styles.option, { paddingLeft: 12 + depth * 18 }]}
                    onPress={() => choose(folder.id)}
                  >
                    <FolderIcon color={currentFolderId === folder.id ? theme.accent : theme.textMuted} size={16} />
                    <Text
                      style={[styles.optionText, { marginLeft: 8 }, currentFolderId === folder.id && styles.optionTextActive]}
                      numberOfLines={1}
                    >
                      {folder.name}
                    </Text>
                    {currentFolderId === folder.id && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.newFolderRow}>
            <TextInput
              style={styles.input}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="New top-level folder…"
              placeholderTextColor={theme.textMuted}
              onSubmitEditing={submitNewFolder}
              returnKeyType="done"
            />
            <Pressable style={styles.createButton} onPress={submitNewFolder}>
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>To nest a folder inside another, open that folder and create it there.</Text>
          <Pressable style={styles.cancelButton} onPress={close}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    },
    card: {
      backgroundColor: theme.bgAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      width: '100%',
      maxWidth: 380
    },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 },
    select: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.borderAccent,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11
    },
    selectText: { flex: 1, fontSize: 14.5, color: theme.text },
    chevron: { color: theme.accent, fontSize: 14 },
    menu: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      overflow: 'hidden'
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border
    },
    optionText: { flex: 1, fontSize: 14.5, color: theme.text },
    optionTextActive: { color: theme.accent, fontWeight: '600' },
    check: { color: theme.accent, fontWeight: '700' },
    newFolderRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.text
    },
    createButton: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
    createButtonText: { color: theme.accentContrast, fontWeight: '600', fontSize: 13.5 },
    hint: { fontSize: 11.5, color: theme.textMuted, marginTop: 8 },
    cancelButton: { alignItems: 'center', marginTop: 14 },
    cancelButtonText: { color: theme.accent, fontSize: 13.5, fontWeight: '600' }
  })
}
