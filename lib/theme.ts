import { useColorScheme } from 'react-native'

// Same palette as the desktop app's global.css (--bg, --accent, etc.) so the two feel like one
// product rather than two apps that happen to share a file format.
export interface Theme {
  dark: boolean
  bg: string
  bgAlt: string
  bgHover: string
  bgActive: string
  text: string
  textMuted: string
  border: string
  accent: string
  accentContrast: string
  success: string
  danger: string
  cardBg: string
}

const light: Theme = {
  dark: false,
  bg: '#ffffff',
  bgAlt: '#f6f5f4',
  bgHover: '#ececea',
  bgActive: '#e4e2ff',
  text: '#1f2023',
  textMuted: '#6b6f76',
  border: '#e3e2e0',
  accent: '#5b4cf0',
  accentContrast: '#ffffff',
  success: '#2b8a3e',
  danger: '#d1453b',
  cardBg: '#ffffff'
}

const dark: Theme = {
  dark: true,
  bg: '#1e1f22',
  bgAlt: '#18191b',
  bgHover: '#2a2b2f',
  bgActive: '#33305e',
  text: '#ecebe9',
  textMuted: '#9a9ea6',
  border: '#313236',
  accent: '#8b7cff',
  accentContrast: '#14141a',
  success: '#3ba354',
  danger: '#e0564c',
  cardBg: '#26272b'
}

export function useTheme(): Theme {
  const scheme = useColorScheme()
  return scheme === 'dark' ? dark : light
}
