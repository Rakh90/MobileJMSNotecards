import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  loadWorkspaceUri,
  pickWorkspaceFolder,
  clearWorkspaceUri,
  listFlashcardDecks,
  type DeckEntry
} from '../lib/workspace'
import { readSampleDeck, SAMPLE_DECK_URI } from '../lib/sampleDeck'
import { SRS_DUE_KEY, isCardDue } from '../lib/srs'
import { useTheme, type Theme } from '../lib/theme'
import type { DatabaseFile } from '../lib/types'

export default function DeckListScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const [workspaceUri, setWorkspaceUri] = useState<string | null>(null)
  const [decks, setDecks] = useState<DeckEntry[]>([])
  const [sampleDeck, setSampleDeck] = useState<DatabaseFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (uri: string | null) => {
    setLoading(true)
    setError(null)
    try {
      if (uri) setDecks(await listFlashcardDecks(uri))
      setSampleDeck(await readSampleDeck())
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(`Could not read that folder (${detail}). It may have moved or lost permission — try choosing it again.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkspaceUri().then((uri) => {
      setWorkspaceUri(uri)
      refresh(uri)
    })
  }, [refresh])

  // Study/Quiz write progress straight back to the same file (or, for the sample deck, to
  // AsyncStorage), so re-scan whenever this screen regains focus to pick up fresh due-counts.
  useFocusEffect(
    useCallback(() => {
      refresh(workspaceUri)
    }, [workspaceUri, refresh])
  )

  async function chooseFolder(): Promise<void> {
    const uri = await pickWorkspaceFolder()
    if (uri) {
      setWorkspaceUri(uri)
      refresh(uri)
    }
  }

  async function changeFolder(): Promise<void> {
    await clearWorkspaceUri()
    setWorkspaceUri(null)
    setDecks([])
  }

  function dueCount(rows: DatabaseFile['rows']): number {
    return rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])).length
  }

  function DeckRow({ uri, file }: { uri: string; file: DatabaseFile }) {
    const due = dueCount(file.rows)
    return (
      <View style={styles.deckRow}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/study/${encodeURIComponent(uri)}`)}>
          <Text style={styles.deckTitle}>{file.title}</Text>
          <Text style={styles.deckMeta}>
            {file.rows.length} card{file.rows.length === 1 ? '' : 's'}
          </Text>
        </Pressable>
        {due > 0 && (
          <View style={styles.dueBadge}>
            <Text style={styles.dueBadgeText}>{due} due</Text>
          </View>
        )}
        <Pressable style={styles.quizButton} onPress={() => router.push(`/quiz/${encodeURIComponent(uri)}`)}>
          <Text style={styles.quizButtonText}>Quiz</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={decks}
        keyExtractor={(d) => d.uri}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(workspaceUri)} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            {sampleDeck && <DeckRow uri={SAMPLE_DECK_URI} file={sampleDeck} />}
            {!workspaceUri && (
              <View style={styles.folderPrompt}>
                <Text style={styles.subtitle}>
                  Point this at your JMSNote workspace folder to see your real decks — the one that
                  syncs to your PC, with a "databases" subfolder inside it.
                </Text>
                <Pressable style={styles.button} onPress={chooseFolder}>
                  <Text style={styles.buttonText}>Choose folder</Text>
                </Pressable>
              </View>
            )}
            {workspaceUri && decks.length === 0 && !loading && (
              <Text style={styles.subtitle}>
                {error ?? 'No flashcard decks found in that folder yet.'}
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          loading && decks.length === 0 && !sampleDeck ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : null
        }
        renderItem={({ item }) => <DeckRow uri={item.uri} file={item.file} />}
      />
      {workspaceUri && (
        <Pressable style={[styles.linkButton, { paddingBottom: 14 + insets.bottom }]} onPress={changeFolder}>
          <Text style={styles.linkButtonText}>Change folder</Text>
        </Pressable>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginBottom: 10 },
    button: { backgroundColor: theme.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignSelf: 'center' },
    buttonText: { color: theme.accentContrast, fontWeight: '600', fontSize: 15 },
    list: { padding: 16 },
    folderPrompt: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' },
    deckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      marginBottom: 10,
      gap: 8
    },
    deckTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    deckMeta: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
    dueBadge: { backgroundColor: theme.bgActive, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    dueBadgeText: { color: theme.accent, fontWeight: '600', fontSize: 12.5 },
    quizButton: { borderWidth: 1, borderColor: theme.accent, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    quizButtonText: { color: theme.accent, fontWeight: '600', fontSize: 13 },
    linkButton: { padding: 14, alignItems: 'center' },
    linkButtonText: { color: theme.accent, fontSize: 13.5 }
  })
}
