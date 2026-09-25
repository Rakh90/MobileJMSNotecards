import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { saveWorkspaceUri, pickWorkspaceFolder, clearWorkspaceUri, DRIVE_PREFIX } from '../lib/workspace'
import { signInToDrive } from '../lib/googleDrive'
import { findFolderByName } from '../lib/driveApi'
import { useDecks } from '../lib/useDecks'
import { useDeckFolders } from '../lib/useDeckFolders'
import { useQuizScores } from '../lib/useQuizScores'
import { createFolder, setDeckFolder, trashFolder, descendantFolderIds } from '../lib/deckFolders'
import DeckRow from '../components/DeckRow'
import MoveToFolderModal from '../components/MoveToFolderModal'
import { useTheme, type Theme } from '../lib/theme'
import { MetalButton, MetalCard } from '../components/Metal'
import FolderIcon from '../components/FolderIcon'
import MenuButton from '../components/MenuButton'
import SortChips from '../components/SortChips'
import { useStreak } from '../lib/streak'
import StudyPickerModal from '../components/StudyPickerModal'
import { DRIVE_PREFIX as DRIVE_URI_PREFIX } from '../lib/workspace'
import { useSortMode, sortDecks } from '../lib/deckSort'

export default function DeckListScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { workspaceUri, setWorkspaceUri, decks, loading, error, setError, refresh, offline, pending } = useDecks()
  const [studyPickerOpen, setStudyPickerOpen] = useState(false)
  const { folders, assignments, trashedCount, reload: reloadFolders } = useDeckFolders()
  const { scores: quizScores } = useQuizScores()
  const [driveConnecting, setDriveConnecting] = useState(false)
  const [search, setSearch] = useState('')
  const streak = useStreak()
  const [sortMode, setSortMode] = useSortMode()
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [moveTarget, setMoveTarget] = useState<{ uri: string; title: string } | null>(null)

  useEffect(() => {
    navigation.setOptions({
      headerRight: workspaceUri
        ? () => (
            <MenuButton
              theme={theme}
              items={[
                { label: 'Study together…', icon: 'study', onPress: () => setStudyPickerOpen(true) },
                { label: 'New folder', icon: 'plus', onPress: () => setCreatingFolder(true) },
                {
                  label: 'Trash',
                  icon: 'trash',
                  badge: trashedCount > 0 ? String(trashedCount) : undefined,
                  onPress: () => router.push('/trash')
                },
                ...(workspaceUri?.startsWith(DRIVE_URI_PREFIX)
                  ? [{ label: 'Download for offline', icon: 'download' as const, onPress: downloadForOffline }]
                  : [])
              ]}
              footerItems={[{ label: 'Change deck source', icon: 'swap', onPress: changeFolder }]}
            />
          )
        : undefined
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, theme, workspaceUri, trashedCount, decks.length])

  async function chooseFolder(): Promise<void> {
    const uri = await pickWorkspaceFolder()
    if (uri) {
      setWorkspaceUri(uri)
      refresh(uri)
    }
  }

  // Signs in, then finds the "JMSNote Flashcards" folder by name directly via the Drive API -
  // the same name the desktop app's "Create Flashcards workspace in Google Drive" button uses.
  // No in-app folder picker needed: full Drive scope means the app can search for it itself,
  // the same way the desktop app locates the Drive mount by a known path.
  async function connectDrive(): Promise<void> {
    setDriveConnecting(true)
    setError(null)
    try {
      await signInToDrive()
      const folderId = await findFolderByName('JMSNote Flashcards')
      if (!folderId) {
        setError(
          'Could not find a "JMSNote Flashcards" folder in your Google Drive. Make sure it has finished syncing from your PC, then try again.'
        )
        return
      }
      const uri = DRIVE_PREFIX + folderId
      saveWorkspaceUri(uri)
      setWorkspaceUri(uri)
      refresh(uri)
    } catch {
      setError('Could not connect to Google Drive. Try again.')
    } finally {
      setDriveConnecting(false)
    }
  }

  async function changeFolder(): Promise<void> {
    await clearWorkspaceUri()
    setWorkspaceUri(null)
  }

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

  async function submitNewFolder(): Promise<void> {
    const name = newFolderName.trim()
    setCreatingFolder(false)
    setNewFolderName('')
    if (!name) return
    await createFolder(name)
    reloadFolders()
  }

  async function assignMoveTarget(folderId: string | null): Promise<void> {
    if (!moveTarget) return
    await setDeckFolder(moveTarget.uri, folderId)
    setMoveTarget(null)
    reloadFolders()
  }

  async function createAndAssign(name: string): Promise<void> {
    if (!moveTarget) return
    const folder = await createFolder(name)
    await setDeckFolder(moveTarget.uri, folder.id)
    setMoveTarget(null)
    reloadFolders()
  }

  async function downloadForOffline(): Promise<void> {
    await refresh(workspaceUri)
    Alert.alert('Saved for offline', 'Your decks are stored on this phone and will open without a connection.')
  }

  const trimmedQuery = search.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return []
    return sortDecks(
      decks.filter((d) => d.file.title.toLowerCase().includes(trimmedQuery)),
      sortMode,
      quizScores
    )
  }, [decks, trimmedQuery, sortMode, quizScores])

  const ungroupedDecks = sortDecks(
    decks.filter((d) => !assignments[d.uri]),
    sortMode,
    quizScores
  )
  const showSearchBar = decks.length > 0

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(workspaceUri)} />}
      >
        {workspaceUri && (offline || pending > 0) && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              {offline ? 'Offline — showing saved copies. ' : ''}
              {pending > 0 ? `${pending} deck${pending === 1 ? '' : 's'} waiting to sync.` : ''}
            </Text>
          </View>
        )}
        {workspaceUri && (
          <View style={styles.streakChip}>
            <Text style={styles.streakText}>
              {streak.streak > 0
                ? `🔥 ${streak.streak}-day streak · ${streak.todayCount} card${streak.todayCount === 1 ? '' : 's'} today`
                : 'Study a card today to start your streak'}
            </Text>
          </View>
        )}
        {showSearchBar && (
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search decks…"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        {showSearchBar && <SortChips theme={theme} mode={sortMode} onChange={setSortMode} />}

        {trimmedQuery ? (
          <>
            {searchResults.map((d) => (
              <DeckRow
                key={d.uri}
                uri={d.uri}
                file={d.file}
                theme={theme}
                quizScore={quizScores[d.uri]}
                onMove={(uri, title) => setMoveTarget({ uri, title })}
              />
            ))}
            {searchResults.length === 0 && (
              <Text style={styles.subtitle}>No decks match "{search.trim()}".</Text>
            )}
          </>
        ) : (
          <>
            {!workspaceUri && (
              <View style={styles.folderPrompt}>
                <Text style={styles.subtitle}>
                  Point this at your JMSNote workspace folder to see your real decks — the one that
                  syncs to your PC, with a "databases" subfolder inside it.
                </Text>
                <MetalButton
                  label="Choose local folder"
                  colors={theme.btnGrad}
                  onPress={chooseFolder}
                  style={{ alignSelf: 'center', marginTop: 8 }}
                />
                <Pressable
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={connectDrive}
                  disabled={driveConnecting}
                >
                  <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                    {driveConnecting ? 'Connecting…' : 'Connect Google Drive'}
                  </Text>
                </Pressable>
                {error && <Text style={[styles.subtitle, { marginTop: 10, marginBottom: 0 }]}>{error}</Text>}
              </View>
            )}

            {workspaceUri && (
              <>
                {folders
                  .filter((f) => f.parentId === null)
                  .map((f) => {
                    // Counts every deck anywhere in this folder's subtree, not just ones
                    // assigned directly to it, since decks typically end up in the deepest
                    // (leaf) subfolder rather than the top-level container.
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
                      placeholder="Folder name…"
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

                {ungroupedDecks.map((d) => (
                  <DeckRow
                    key={d.uri}
                    uri={d.uri}
                    file={d.file}
                    theme={theme}
                    quizScore={quizScores[d.uri]}
                    onMove={(uri, title) => setMoveTarget({ uri, title })}
                  />
                ))}

                {decks.length === 0 && !loading && (
                  <Text style={styles.subtitle}>{error ?? 'No flashcard decks found in that folder yet.'}</Text>
                )}
              </>
            )}
          </>
        )}

        {loading && decks.length === 0 && (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
      </ScrollView>
      <StudyPickerModal
        visible={studyPickerOpen}
        theme={theme}
        folders={folders}
        decks={decks}
        assignments={assignments}
        rootId={null}
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
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginBottom: 10 },
    button: {
      backgroundColor: theme.accent,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignSelf: 'center',
      marginTop: 8
    },
    buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent },
    buttonText: { color: theme.accentContrast, fontWeight: '600', fontSize: 15 },
    buttonTextSecondary: { color: theme.accent },
    list: { padding: 16 },
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
    folderPrompt: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' },
    folderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14
    },
    folderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    folderRowText: { fontSize: 15.5, fontWeight: '600', color: theme.text },
    offlineBanner: {
      borderWidth: 1,
      borderColor: theme.warning,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 12
    },
    offlineText: { color: theme.warning, fontSize: 12.5 },
    streakChip: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.borderAccent,
      backgroundColor: theme.bgActive,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 14,
      marginBottom: 12
    },
    streakText: { color: theme.text, fontSize: 13, fontWeight: '600' },
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
    newFolderCreateText: { color: theme.accentContrast, fontWeight: '600', fontSize: 13.5 },
    bottomLinks: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
    linkButton: { padding: 14, alignItems: 'center' },
    linkButtonText: { color: theme.accent, fontSize: 13.5 }
  })
}
