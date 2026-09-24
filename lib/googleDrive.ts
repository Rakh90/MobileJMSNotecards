import { GoogleSignin } from '@react-native-google-signin/google-signin'

// drive.file only grants access to files the app individually creates or opens via Picker - it
// does NOT recurse into a picked folder's existing contents, which made it useless for "auto
// -discover whatever decks are in this folder" (confirmed after decks synced from the desktop
// app came back invisible to the API despite the folder itself being accessible). Full drive
// scope is the only way to search/read/write a folder's contents by name without re-picking
// every file by hand - the tradeoff is Google forcing re-login roughly every 7 days while this
// app stays unverified (Testing mode), which is acceptable for a personal-use app.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

let configured = false

function ensureConfigured(): void {
  if (configured) return
  GoogleSignin.configure({ scopes: [DRIVE_SCOPE] })
  configured = true
}

export async function isDriveSignedIn(): Promise<boolean> {
  ensureConfigured()
  return GoogleSignin.hasPreviousSignIn()
}

export async function signInToDrive(): Promise<void> {
  ensureConfigured()
  await GoogleSignin.hasPlayServices()
  await GoogleSignin.signIn()
}

let inFlightTokenRequest: Promise<string> | null = null

// Play Services caches and silently refreshes the underlying OAuth token itself, so calling
// this right before every Drive API request (rather than tracking our own expiry) is the
// correct and cheap way to always have a valid token. The native module only tolerates one
// getTokens() call at a time (a second call while one is still in flight is rejected with
// "previous promise did not settle and was overwritten") - listing several decks fires several
// of these back to back, so callers share a single in-flight request instead of each starting
// their own.
export async function getDriveAccessToken(): Promise<string> {
  ensureConfigured()
  if (inFlightTokenRequest) return inFlightTokenRequest
  inFlightTokenRequest = (async () => {
    try {
      const { accessToken } = await GoogleSignin.getTokens()
      return accessToken
    } catch {
      await GoogleSignin.signInSilently()
      const { accessToken } = await GoogleSignin.getTokens()
      return accessToken
    }
  })()
  try {
    return await inFlightTokenRequest
  } finally {
    inFlightTokenRequest = null
  }
}

export async function signOutOfDrive(): Promise<void> {
  ensureConfigured()
  await GoogleSignin.signOut()
}
