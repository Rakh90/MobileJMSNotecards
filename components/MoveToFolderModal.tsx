import { useState } from 'react'
import { Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native'
import type { Theme } from '../lib/theme'
import type { DeckFolder } from '../lib/deckFolders'

function FolderTreeRow({
  folder,
  allFolders,
  depth,
  currentFolderId,
  collapsed,
  toggleCollapsed,
  onSelect,
  styles
}: {
  folder: DeckFolder
  allFolders: DeckFolder[]
  depth: number
  currentFolderId: string | null
  collapsed: Record<string, boolean>
  toggleCollapsed: (id: string) => void
  onSelect: (id: string) => void
  styles: ReturnType<typeof makeStyles>
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id)
  const isCollapsed = collapsed[folder.id]
  const isActive = currentFolderId === folder.id
  return (
    <>
      <Pressable style={[styles.option, { paddingLeft: 14 + depth * 20 }]} onPress={() => onSelect(folder.id)}>
        {children.length > 0 ? (
          <Pressable onPress={() => toggleCollapsed(folder.id)} hitSlop={10} style={styles.disclosure}>
            <Text style={styles.disclosureText}>{isCollapsed ? '▸' : '▾'}</Text>
          </Pressable>
        ) : (
          <View style={styles.disclosure} />
        )}
        <Text style={[styles.optionText, isActive && styles.optionTextActive]} numberOfLines={1}>
          📁 {folder.name}
        </Text>
        {isActive && <Text style={styles.check}>✓</Text>}
      </Pressable>
      {!isCollapsed &&
        children.map((c) => (
          <FolderTreeRow
            key={c.id}
            folder={c}
            allFolders={allFolders}
            depth={depth + 1}
            currentFolderId={currentFolderId}
            collapsed={collapsed}
            toggleCollapsed={toggleCollapsed}
            onSelect={onSelect}
            styles={styles}
          />
        ))}
    </>
  )
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const styles = makeStyles(theme)

  if (deckTitle === null) return null

  function toggleCollapsed(id: string): void {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }))
  }

  function submitNewFolder(): void {
    const name = newFolderName.trim()
    if (!name) return
    onCreateAndAssign(name)
    setNewFolderName('')
  }

  const roots = folders.filter((f) => f.parentId === null)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Move "{deckTitle}" to…</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            <Pressable style={styles.option} onPress={() => onAssign(null)}>
              <View style={styles.disclosure} />
              <Text style={[styles.optionText, currentFolderId === null && styles.optionTextActive]}>
                No folder
              </Text>
              {currentFolderId === null && <Text style={styles.check}>✓</Text>}
            </Pressable>
            {roots.map((f) => (
              <FolderTreeRow
                key={f.id}
                folder={f}
                allFolders={folders}
                depth={0}
                currentFolderId={currentFolderId}
                collapsed={collapsed}
                toggleCollapsed={toggleCollapsed}
                onSelect={onAssign}
                styles={styles}
              />
            ))}
          </ScrollView>
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
          <Pressable style={styles.cancelButton} onPress={onClose}>
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
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    },
    card: { backgroundColor: theme.bg, borderRadius: 14, padding: 18, width: '100%', maxWidth: 380 },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 10 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingRight: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border
    },
    disclosure: { width: 22, alignItems: 'center' },
    disclosureText: { color: theme.textMuted, fontSize: 13 },
    optionText: { flex: 1, fontSize: 15, color: theme.text },
    optionTextActive: { color: theme.accent, fontWeight: '600' },
    check: { color: theme.accent, fontWeight: '700' },
    newFolderRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
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
