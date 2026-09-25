import { useColorScheme } from 'react-native'

// Blue metallic palette. Surfaces are deep navy in dark mode and a cool off-white in light mode;
// buttons and cards use the *Grad pairs (top -> bottom) with a glossy sheen laid on top.
export type Gradient = [string, string]

export interface Theme {
  dark: boolean
  bg: string
  bgAlt: string
  bgHover: string
  bgActive: string
  text: string
  textMuted: string
  border: string
  borderAccent: string
  accent: string
  accentContrast: string
  success: string
  warning: string
  danger: string
  cardBg: string
  cardGrad: Gradient
  headerGrad: Gradient
  btnGrad: Gradient
  successGrad: Gradient
  dangerGrad: Gradient
}

const light: Theme = {
  dark: false,
  bg: '#f2f6ff',
  bgAlt: '#e8efff',
  bgHover: '#dde7fb',
  bgActive: '#d6e4ff',
  text: '#0f1b33',
  textMuted: '#5b6b8c',
  border: '#cbd9f2',
  borderAccent: '#7aa5f0',
  accent: '#2a62d6',
  accentContrast: '#ffffff',
  success: '#2b8a3e',
  warning: '#b8860b',
  danger: '#d1453b',
  cardBg: '#ffffff',
  cardGrad: ['#ffffff', '#e9f0ff'],
  headerGrad: ['#ffffff', '#dfe9ff'],
  btnGrad: ['#5b9bff', '#2a62d6'],
  successGrad: ['#4cc46a', '#26873e'],
  dangerGrad: ['#f07068', '#c4372f']
}

const dark: Theme = {
  dark: true,
  bg: '#0d1526',
  bgAlt: '#0b1220',
  bgHover: '#16233f',
  bgActive: '#1f3563',
  text: '#e8f0ff',
  textMuted: '#7f93b8',
  border: '#24345a',
  borderAccent: '#2d4a86',
  accent: '#6aa5ff',
  accentContrast: '#ffffff',
  success: '#3ba354',
  warning: '#e0b02e',
  danger: '#e0564c',
  cardBg: '#131f38',
  cardGrad: ['#1a2a4a', '#131f38'],
  headerGrad: ['#16233f', '#0d1526'],
  btnGrad: ['#5b9bff', '#2a62d6'],
  successGrad: ['#4cc46a', '#26873e'],
  dangerGrad: ['#f07068', '#c4372f']
}

export function useTheme(): Theme {
  const scheme = useColorScheme()
  return scheme === 'dark' ? dark : light
}
