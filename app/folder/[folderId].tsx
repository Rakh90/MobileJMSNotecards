import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, RefreshControl, Alert } from 'react-native'
import { useLocalSearchParams, useNavigation, router } from 'expo-router'
import { useDecks } from '../../lib/useDecks'
import { useDeckFolders } from '../../lib/useDeckFolders'
import { useQuizScores } from '../../lib/useQuizScores'
import { setDeckFolder, createFolder, trashFolder, descendantFolderIds } from '../../lib/deckFolders'
import DeckRow from '../../components/DeckRow'
import MoveToFolderModal from '../../components/MoveToFolderModal'
import { useTheme, type Theme } from '../../lib/theme'
import { MetalCard } from '../../components/Metal'
import FolderIcon from '../../components/FolderIcon'
import MenuButton from '../../components/MenuButton'
import StudyPickerModal from '../../components/StudyPickerModal'
import SortChips from '../../components/SortChips'
import { useSortMode, sortDecks } from '../../lib/deckSort'

export default function FolderScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { folderId, name } = useLocalSearchParams<{ folderId: string; name?: string }>()
  const navigation = useNavigation()
  const { workspaceUri, decks, loading, refresh } = useDecks()
  const { folders, assignments, reload: reloadFolders } = useDeckFolders()
  const { scores: quizScores } = useQuizScores()
  const [search, setSearch] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [studyPickerOpen, setStudyPickerOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [moveTarget, setMoveTarget] = useState<{ uri: string; title: string } | null>(null)

  const folderName = folders.find((f) => f.id === folderId)?.name ?? name ?? 'Folder'

  useEffect(() => {
    navigation.setOptions({
      title: folderName,
      headerRight: () => (
        <MenuButton
          theme={theme}
          items={[
            { label: 'Study this folder…', icon: 'study', onPress: () => setStudyPickerOpen(true) },
            { label: 'New subfolder', icon: 'plus', onPress: () => setCreatingFolder(true) }
          ]}
        />
      )
    })
  }, [folderName, navigation, theme])

  function openFolderMenu(f: { id: string; name: string }): void {
    Alert.alert(f.name, undefined, [
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: async () => {
          await trashFolder(f.id)
          reloadFolders()
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ])
  }

  const subfolders = folders.filter((f) => f.parentId === folderId)
  const [sortMode, setSortMode] = useSortMode()
  const ownDecks = sortDecks(
    decks.filter((d) => assignments[d.uri] === folderId),
    sortMode,
    quizScores
  )

  const trimmed = search.trim().toLowerCase()
  // Search reaches into every nested subfolder, not just decks directly in this one.
  const searchResults = useMemo(() => {
    if (!trimmed) return []
    const idsInTree = new Set([folderId, ...descendantFolderIds(folders, folderId)])
    return sortDecks(
      decks.filter(
        (d) => assignments[d.uri] && idsInTree.has(assignments[d.uri]) && d.file.title.toLowerCase().includes(trimmed)
      ),
      sortMode,
      quizScores
    )
  }, [decks, assignments, folders, folderId, trimmed, sortMode, quizScores])

  async function submitNewFolder(): Promise<void> {
    const trimmedName = newFolderName.trim()
    setCreatingFolder(false)
    setNewFolderName('')
    if (!trimmedName) return
    await createFolder(trimmedName, folderId)
    reloadFolders()
  }

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

  const hasAnything = subfolders.length > 0 || ownDecks.length > 0

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(workspaceUri)} />}
      >
        {hasAnything && (
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
        {hasAnything && <SortChips theme={theme} mode={sortMode} onChange={setSortMode} />}

        {trimmed ? (
          <>
            {searchResults.map((d) => (
              <DeckRow
                key={d.uri}
                uri={d.uri}
                file={d.file}
                theme={theme}
                quizScore={quizScores[d.uri]}
                onMove={(uri, title) => setMoveTarget({ uri, title })}
                onChanged={() => refresh(workspaceUri)}
              />
            ))}
            {searchResults.length === 0 && <Text style={styles.subtitle}>No decks match "{search.trim()}".</Text>}
          </>
        ) : (
          <>
            {subfolders.map((f) => {
              const idsInTree = new Set([f.id, ...descendantFolderIds(folders, f.id)])
              const count = decks.filter((d) => assignments[d.uri] && idsInTree.has(assignments[d.uri])).length
              return (
                <MetalCard key={f.id} theme={theme} style={{ marginBottom: 10 }}>
                  <Pressable
                    style={styles.folderRow}
                    onPress={() => router.push(`/folder/${f.id}?name=${encodeURIComponent(f.name)}`)}
                    onLongPress={() => openFolderMenu(f)}
                  >
                    <View style={styles.folderNameRow}>
                      <FolderIcon color={theme.accent} size={20} />
                      <Text style={styles.folderRowText}>{f.name}</Text>
                    </View>
                    <Text style={styles.folderRowCount}>
                      {`${count} deck${count === 1 ? '' : 's'} ›`}
                    </Text>
                  </Pressable>
                </MetalCard>
              )
            })}

            {creatingFolder && (
              <View style={styles.newFolderRow}>
                <TextInput
                  style={styles.newFolderInput}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Subfolder name…"
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                  onSubmitEditing={submitNewFolder}
                  returnKeyType="done"
                />
                <Pressable style={styles.newFolderCreate} onPress={submitNewFolder}>
                  <Text style={styles.newFolderCreateText}>Add</Text>
                </Pressable>
              </View>
            )}

            {ownDecks.map((d) => (
              <DeckRow
                key={d.uri}
                uri={d.uri}
                file={d.file}
                theme={theme}
                quizScore={quizScores[d.uri]}
                onMove={(uri, title) => setMoveTarget({ uri, title })}
                onChanged={() => refresh(workspaceUri)}
              />
            ))}

            {!hasAnything && !loading && (
              <Text style={styles.subtitle}>
                Nothing here yet — move a deck into this folder from the main screen, or add a subfolder.
              </Text>
            )}
          </>
        )}
      </ScrollView>
      <StudyPickerModal
        visible={studyPickerOpen}
        theme={theme}
        folders={folders}
        decks={decks}
        assignments={assignments}
        rootId={folderId}
        onClose={() => setStudyPickerOpen(false)}
        onStart={(uris, mode) => {
          setStudyPickerOpen(false)
          router.push(`/study/mixed?uris=${encodeURIComponent(JSON.stringify(uris))}&mode=${mode}`)
        }}
      />
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
    },
    folderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14
    },
    folderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    folderRowText: { fontSize: 15.5, fontWeight: '600', color: theme.text },
    folderRowCount: { fontSize: 13, color: theme.textMuted, flexShrink: 0, marginLeft: 12, paddingRight: 8 },
    newFolderRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    newFolderInput: {
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
    newFolderCreate: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
    newFolderCreateText: { color: theme.accentContrast, fontWeight: '600', fontSize: 13.5 }
  })
}
