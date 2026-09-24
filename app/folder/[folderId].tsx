import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl } from 'react-native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useDecks } from '../../lib/useDecks'
import { useDeckFolders } from '../../lib/useDeckFolders'
import { setDeckFolder, createFolder } from '../../lib/deckFolders'
import DeckRow from '../../components/DeckRow'
import MoveToFolderModal from '../../components/MoveToFolderModal'
import { useTheme, type Theme } from '../../lib/theme'

export default function FolderScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { folderId, name } = useLocalSearchParams<{ folderId: string; name?: string }>()
  const navigation = useNavigation()
  const { workspaceUri, decks, loading, refresh } = useDecks()
  const { folders, assignments, reload: reloadFolders } = useDeckFolders()
  const [search, setSearch] = useState('')
  const [moveTarget, setMoveTarget] = useState<{ uri: string; title: string } | null>(null)

  const folderName = folders.find((f) => f.id === folderId)?.name ?? name ?? 'Folder'

  useEffect(() => {
    navigation.setOptions({ title: folderName })
  }, [folderName, navigation])

  const deckList = decks.filter((d) => assignments[d.uri] === folderId)
  const trimmed = search.trim().toLowerCase()
  const filtered = trimmed ? deckList.filter((d) => d.file.title.toLowerCase().includes(trimmed)) : deckList

  async function assignMoveTarget(newFolderId: string | null): Promise<void> {
    if (!moveTarget) return
    await setDeckFolder(moveTarget.uri, newFolderId)
    setMoveTarget(null)
    reloadFolders()
  }

  async function createAndAssign(newName: string): Promise<void> {
    if (!moveTarget) return
    const folder = await createFolder(newName)
    await setDeckFolder(moveTarget.uri, folder.id)
    setMoveTarget(null)
    reloadFolders()
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(workspaceUri)} />}
      >
        {deckList.length > 0 && (
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search this folder…"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        {filtered.map((d) => (
          <DeckRow
            key={d.uri}
            uri={d.uri}
            file={d.file}
            theme={theme}
            onMove={(uri, title) => setMoveTarget({ uri, title })}
          />
        ))}
        {deckList.length === 0 && !loading && (
          <Text style={styles.subtitle}>No decks in this folder yet — move one here from the main screen.</Text>
        )}
        {filtered.length === 0 && deckList.length > 0 && (
          <Text style={styles.subtitle}>No decks match "{search.trim()}".</Text>
        )}
      </ScrollView>
      <MoveToFolderModal
        deckTitle={moveTarget?.title ?? null}
        folders={folders}
        currentFolderId={moveTarget ? assignments[moveTarget.uri] ?? null : null}
        theme={theme}
        onAssign={assignMoveTarget}
        onCreateAndAssign={createAndAssign}
        onClose={() => setMoveTarget(null)}
      />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    list: { padding: 16 },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: 10 },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      marginBottom: 12
    }
  })
}
