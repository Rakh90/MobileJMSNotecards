import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native'
import { useFocusEffect, useNavigation } from 'expo-router'
import { loadTrashedFolders, restoreFolder, permanentlyDeleteFolder, type DeckFolder } from '../lib/deckFolders'
import { useTheme, type Theme } from '../lib/theme'
import FolderIcon from '../components/FolderIcon'

export default function TrashScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const navigation = useNavigation()
  const [trashed, setTrashed] = useState<DeckFolder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    navigation.setOptions({ title: 'Trash' })
  }, [navigation])

  const reload = useCallback(async () => {
    setLoading(true)
    setTrashed(await loadTrashedFolders())
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )

  async function restore(id: string): Promise<void> {
    await restoreFolder(id)
    reload()
  }

  function confirmDeleteForever(folder: DeckFolder): void {
    Alert.alert(
      `Delete "${folder.name}" forever?`,
      'This cannot be undone. Any decks that were inside it become unassigned rather than deleted — your deck files are never touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            await permanentlyDeleteFolder(folder.id)
            reload()
          }
        }
      ]
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {trashed.length === 0 && !loading && <Text style={styles.subtitle}>Trash is empty.</Text>}
        {trashed.map((f) => (
          <View key={f.id} style={styles.row}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FolderIcon color={theme.textMuted} size={20} />
              <Text style={styles.rowText} numberOfLines={1}>
                {f.name}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => restore(f.id)} hitSlop={8}>
                <Text style={styles.restoreText}>Restore</Text>
              </Pressable>
              <Pressable onPress={() => confirmDeleteForever(f)} hitSlop={8}>
                <Text style={styles.deleteText}>Delete forever</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    list: { padding: 16 },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      marginBottom: 10,
      gap: 8
    },
    rowText: { flex: 1, fontSize: 15, color: theme.text },
    actions: { flexDirection: 'row', gap: 16 },
    restoreText: { color: theme.accent, fontSize: 13.5, fontWeight: '600' },
    deleteText: { color: theme.danger, fontSize: 13.5, fontWeight: '600' }
  })
}
