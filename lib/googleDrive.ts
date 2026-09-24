import { GoogleSignin } from '@react-native-google-signin/google-signin'

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

let configured = false

function ensureConfigured(): void {
  if (configured) return
  GoogleSignin.configure({ scopes: [DRIVE_FILE_SCOPE] })
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

// Play Services caches and silently refreshes the underlying OAuth token itself, so calling
// this right before every Drive API request (rather than tracking our own expiry) is the
// correct and cheap way to always have a valid token.
export async function getDriveAccessToken(): Promise<string> {
  ensureConfigured()
  try {
    const { accessToken } = await GoogleSignin.getTokens()
    return accessToken
  } catch {
    await GoogleSignin.signInSilently()
    const { accessToken } = await GoogleSignin.getTokens()
    return accessToken
  }
}

export async function signOutOfDrive(): Promise<void> {
  ensureConfigured()
  await GoogleSignin.signOut()
}
