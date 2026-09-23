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
import { SRS_DUE_KEY, isCardDue } from '../lib/srs'

export default function DeckListScreen() {
  const [workspaceUri, setWorkspaceUri] = useState<string | null>(null)
  const [decks, setDecks] = useState<DeckEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (uri: string) => {
    setLoading(true)
    setError(null)
    try {
      const found = await listFlashcardDecks(uri)
      setDecks(found)
    } catch (e) {
      setError('Could not read that folder. It may have moved or lost permission — try choosing it again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkspaceUri().then((uri) => {
      setWorkspaceUri(uri)
      if (uri) refresh(uri)
      else setLoading(false)
    })
  }, [refresh])

  // Study screen writes progress straight back to the same file, so re-scan whenever this
  // screen regains focus (e.g. navigating back from studying) to pick up fresh due-counts.
  useFocusEffect(
    useCallback(() => {
      if (workspaceUri) refresh(workspaceUri)
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

  function dueCount(deck: DeckEntry): number {
    return deck.file.rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])).length
  }

  if (!workspaceUri) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Point this at your JMSNote workspace folder</Text>
        <Text style={styles.subtitle}>
          The folder that syncs to your PC (e.g. via a Google Drive-synced folder). It needs a
          "databases" subfolder inside it — that's created automatically the first time you make a
          flashcard deck on the desktop app.
        </Text>
        <Pressable style={styles.button} onPress={chooseFolder}>
          <Text style={styles.buttonText}>Choose folder</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {loading && decks.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(d) => d.uri}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(workspaceUri)} />}
          contentContainerStyle={decks.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.subtitle}>
                {error ?? 'No flashcard decks found yet. Create one in JMSNote on your PC first.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const due = dueCount(item)
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
      )}
      <Pressable style={styles.linkButton} onPress={changeFolder}>
        <Text style={styles.linkButtonText}>Change folder</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  button: { backgroundColor: '#5b4cf0', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  list: { padding: 16, gap: 10 },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e2e0',
    marginBottom: 10
  },
  deckTitle: { fontSize: 16, fontWeight: '600' },
  deckMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  dueBadge: { backgroundColor: '#e4e2ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  dueBadgeText: { color: '#5b4cf0', fontWeight: '600', fontSize: 12.5 },
  linkButton: { padding: 14, alignItems: 'center' },
  linkButtonText: { color: '#5b4cf0', fontSize: 13.5 }
})
