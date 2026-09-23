import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import {
  loadWorkspaceUri,
  pickWorkspaceFolder,
  clearWorkspaceUri,
  listFlashcardDecks,
  type DeckEntry
} from '../lib/workspace'
import { readSampleDeck, SAMPLE_DECK_URI } from '../lib/sampleDeck'
import { SRS_DUE_KEY, isCardDue } from '../lib/srs'
import type { DatabaseFile } from '../lib/types'

export default function DeckListScreen() {
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
    } catch {
      setError('Could not read that folder. It may have moved or lost permission — try choosing it again.')
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

  // Study screen writes progress straight back to the same file (or, for the sample deck, to
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

  return (
    <View style={styles.container}>
      <FlatList
        data={decks}
        keyExtractor={(d) => d.uri}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(workspaceUri)} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            {sampleDeck && (
              <Pressable
                style={[styles.deckRow, styles.sampleRow]}
                onPress={() => router.push(`/study/${encodeURIComponent(SAMPLE_DECK_URI)}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.deckTitle}>🧪 {sampleDeck.title}</Text>
                  <Text style={styles.deckMeta}>Built in — for trying the app out, not your real notes</Text>
                </View>
                {dueCount(sampleDeck.rows) > 0 && (
                  <View style={styles.dueBadge}>
                    <Text style={styles.dueBadgeText}>{dueCount(sampleDeck.rows)} due</Text>
                  </View>
                )}
              </Pressable>
            )}
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
              <ActivityIndicator />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const due = dueCount(item.file.rows)
          return (
            <Pressable
              style={styles.deckRow}
              onPress={() => router.push(`/study/${encodeURIComponent(item.uri)}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.deckTitle}>{item.file.title}</Text>
                <Text style={styles.deckMeta}>
                  {item.file.rows.length} card{item.file.rows.length === 1 ? '' : 's'}
                </Text>
              </View>
              {due > 0 && (
                <View style={styles.dueBadge}>
                  <Text style={styles.dueBadgeText}>{due} due</Text>
                </View>
              )}
            </Pressable>
          )
        }}
      />
      {workspaceUri && (
        <Pressable style={styles.linkButton} onPress={changeFolder}>
          <Text style={styles.linkButtonText}>Change folder</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 10 },
  button: { backgroundColor: '#5b4cf0', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignSelf: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  list: { padding: 16 },
  folderPrompt: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e3e2e0', borderStyle: 'dashed' },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e2e0',
    marginBottom: 10
  },
  sampleRow: { borderColor: '#5b4cf0', borderStyle: 'dashed' },
  deckTitle: { fontSize: 16, fontWeight: '600' },
  deckMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  dueBadge: { backgroundColor: '#e4e2ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  dueBadgeText: { color: '#5b4cf0', fontWeight: '600', fontSize: 12.5 },
  linkButton: { padding: 14, alignItems: 'center' },
  linkButtonText: { color: '#5b4cf0', fontSize: 13.5 }
})
