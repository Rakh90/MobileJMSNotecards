import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SORT_LABELS, type SortMode } from '../lib/deckSort'
import type { Theme } from '../lib/theme'

export default function SortChips({ theme, mode, onChange }: { theme: Theme; mode: SortMode; onChange: (m: SortMode) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => {
        const active = m === mode
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[
              styles.chip,
              { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.bgActive : 'transparent' }
            ]}
          >
            <Text style={{ color: active ? theme.accent : theme.textMuted, fontSize: 12.5, fontWeight: active ? '600' : '400' }}>
              {SORT_LABELS[m]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }
})
