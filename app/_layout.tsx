import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useTheme } from '../lib/theme'

export default function RootLayout() {
  const theme = useTheme()
  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
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
    </SafeAreaProvider>
  )
}
