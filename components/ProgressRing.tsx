import { Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import type { Theme } from '../lib/theme'

// Mastery ring: green at 100%, yellow from 70%, red below - same thresholds as the quiz score.
export default function ProgressRing({ pct, theme, size = 38 }: { pct: number; theme: Theme; size?: number }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = pct >= 100 ? theme.success : pct > 69 ? theme.warning : theme.danger
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(Math.min(pct, 100) / 100) * c} ${c}`}
        />
      </Svg>
      <Text style={{ color: theme.text, fontSize: 10.5, fontWeight: '700' }}>{Math.round(pct)}%</Text>
    </View>
  )
}
