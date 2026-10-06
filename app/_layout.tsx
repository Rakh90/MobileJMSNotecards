import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaProvider, SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../lib/theme'

// Sideways, the camera cutout and the on-screen navigation buttons sit at the left/right edges;
// padding the whole app by those insets keeps headers and content clear of them. The side insets
// are zeroed for everything inside, so the header doesn't pad a second time.
function Screens() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const innerInsets = { top: insets.top, bottom: insets.bottom, left: 0, right: 0 }
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingLeft: insets.left, paddingRight: insets.right }}>
      <SafeAreaInsetsContext.Provider value={innerInsets}>
        <Stack
          screenOptions={{
            headerShown: true,
            headerBackground: () => (
              <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: theme.borderAccent }}>
                <LinearGradient colors={theme.headerGrad} style={{ flex: 1 }} />
              </View>
            ),
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            contentStyle: { backgroundColor: theme.bg }
          }}
        >
          <Stack.Screen name="index" options={{ title: 'JMSNote Flashcards' }} />
          <Stack.Screen name="study/[deckId]" options={{ title: 'Study' }} />
          <Stack.Screen name="quiz/[deckId]" options={{ title: 'Quiz' }} />
        </Stack>
      </SafeAreaInsetsContext.Provider>
    </View>
  )
}

export default function RootLayout() {
  const theme = useTheme()
  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Screens />
    </SafeAreaProvider>
  )
}
