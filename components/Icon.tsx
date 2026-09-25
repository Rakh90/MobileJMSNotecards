import Svg, { Path } from 'react-native-svg'

const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  study: 'M4 5h16v14H4zM8 9h8M8 13h5',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  swap: 'M4 4v6h6M20 20v-6h-6M20 10a8 8 0 0 0-14-3L4 10M4 14a8 8 0 0 0 14 3l2-3'
} as const

export type IconName = keyof typeof PATHS

export default function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  )
}
