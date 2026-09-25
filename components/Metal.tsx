import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { Gradient, Theme } from '../lib/theme'

// The glossy highlight that sits across the top of every metallic surface.
export function Sheen({ radius = 0, height = '45%' }: { radius?: number; height?: `${number}%` }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, borderTopLeftRadius: radius, borderTopRightRadius: radius }}
    />
  )
}

// A brushed-metal panel: vertical gradient, thin accent border, glossy top edge.
export function MetalCard({
  theme,
  radius = 12,
  style,
  children
}: {
  theme: Theme
  radius?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  return (
    <View style={[{ borderRadius: radius, borderWidth: 1, borderColor: theme.borderAccent, overflow: 'hidden' }, style]}>
      <LinearGradient colors={theme.cardGrad} style={StyleSheet.absoluteFill} />
      <Sheen radius={radius} height="40%" />
      {children}
    </View>
  )
}

export function MetalButton({
  label,
  onPress,
  colors,
  style,
  textStyle,
  disabled
}: {
  label: string
  onPress: () => void
  colors: Gradient
  style?: StyleProp<ViewStyle>
  textStyle?: object
  disabled?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[{ borderRadius: 10, overflow: 'hidden' }, style]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      <Sheen radius={10} height="50%" />
      <Text style={[{ color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center', paddingVertical: 13, paddingHorizontal: 22 }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  )
}
