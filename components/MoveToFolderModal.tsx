import { useState } from 'react'
import { Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native'
import type { Theme } from '../lib/theme'
import type { DeckFolder } from '../lib/deckFolders'

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
  const styles = makeStyles(theme)

  if (deckTitle === null) return null

  function submitNewFolder(): void {
    const name = newFolderName.trim()
    if (!name) return
    onCreateAndAssign(name)
    setNewFolderName('')
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Move "{deckTitle}" to…</Text>
          <ScrollView style={{ maxHeight: 260 }}>
            <Pressable style={styles.option} onPress={() => onAssign(null)}>
              <Text style={[styles.optionText, currentFolderId === null && styles.optionTextActive]}>
                No folder
              </Text>
              {currentFolderId === null && <Text style={styles.check}>✓</Text>}
            </Pressable>
            {folders.map((f) => (
              <Pressable key={f.id} style={styles.option} onPress={() => onAssign(f.id)}>
                <Text style={[styles.optionText, currentFolderId === f.id && styles.optionTextActive]}>
                  📁 {f.name}
                </Text>
                {currentFolderId === f.id && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.newFolderRow}>
            <TextInput
              style={styles.input}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="New folder name…"
              placeholderTextColor={theme.textMuted}
              onSubmitEditing={submitNewFolder}
              returnKeyType="done"
            />
            <Pressable style={styles.createButton} onPress={submitNewFolder}>
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          </View>
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
    card: { backgroundColor: theme.bg, borderRadius: 14, padding: 18, width: '100%', maxWidth: 360 },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 10 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border
    },
    optionText: { fontSize: 15, color: theme.text },
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
    cancelButton: { alignItems: 'center', marginTop: 14 },
    cancelButtonText: { color: theme.accent, fontSize: 13.5, fontWeight: '600' }
  })
}
