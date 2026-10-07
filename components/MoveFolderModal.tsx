import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Theme } from '../lib/theme'
import { descendantFolderIds, type DeckFolder } from '../lib/deckFolders'
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

// Pick the folder (or the top level) that another folder should live in. The folder itself and
// everything inside it are left out, since a folder can't be moved into its own contents.
export default function MoveFolderModal({
  target,
  folders,
  theme,
  onChoose,
  onClose
}: {
  target: { id: string; name: string } | null
  folders: DeckFolder[]
  theme: Theme
  onChoose: (parentId: string | null) => void
  onClose: () => void
}) {
  const styles = makeStyles(theme)
  if (!target) return null
  const blocked = new Set([target.id, ...descendantFolderIds(folders, target.id)])
  const currentParent = folders.find((f) => f.id === target.id)?.parentId ?? null
  const options = flatten(folders.filter((f) => !blocked.has(f.id)))

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={2}>{`Move "${target.name}" to…`}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            <Pressable style={styles.option} onPress={() => onChoose(null)}>
              <Text style={[styles.optionText, currentParent === null && styles.active]}>Top level (not inside a folder)</Text>
              {currentParent === null && <Text style={styles.check}>✓</Text>}
            </Pressable>
            {options.map(({ folder, depth }) => (
              <Pressable
                key={folder.id}
                style={[styles.option, { paddingLeft: 12 + depth * 18 }]}
                onPress={() => onChoose(folder.id)}
              >
                <FolderIcon color={currentParent === folder.id ? theme.accent : theme.textMuted} size={16} />
                <Text style={[styles.optionText, { marginLeft: 8 }, currentParent === folder.id && styles.active]} numberOfLines={1}>
                  {folder.name}
                </Text>
                {currentParent === folder.id && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ))}
            {options.length === 0 && <View style={{ height: 4 }} />}
          </ScrollView>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
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
    title: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border
    },
    optionText: { flex: 1, fontSize: 14.5, color: theme.text },
    active: { color: theme.accent, fontWeight: '600' },
    check: { color: theme.accent, fontWeight: '700' },
    cancel: { alignItems: 'center', marginTop: 14 },
    cancelText: { color: theme.accent, fontSize: 13.5, fontWeight: '600' }
  })
}
