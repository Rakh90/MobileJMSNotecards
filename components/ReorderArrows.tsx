import { Pressable, View } from 'react-native'
import Icon from './Icon'
import type { Theme } from '../lib/theme'

// Up/down buttons shown on a folder card while rearranging folders.
export default function ReorderArrows({
  theme,
  canUp,
  canDown,
  onUp,
  onDown
}: {
  theme: Theme
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Pressable onPress={onUp} disabled={!canUp} hitSlop={6} style={{ padding: 6, opacity: canUp ? 1 : 0.3 }}>
        <Icon name="up" color={theme.accent} size={24} />
      </Pressable>
      <Pressable onPress={onDown} disabled={!canDown} hitSlop={6} style={{ padding: 6, opacity: canDown ? 1 : 0.3 }}>
        <Icon name="down" color={theme.accent} size={24} />
      </Pressable>
    </View>
  )
}
