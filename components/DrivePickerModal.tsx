import { useState } from 'react'
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Restricted (Cloud Console -> Credentials) to Google Drive API + Google Picker API only.
const API_KEY = 'AIzaSyDq1XWB7E9mBbt0AHDUBPo0pBmhjEDNhZ8'
// Cloud project *number* (not project ID) - required by Picker when the OAuth token uses the
// drive.file scope, so it can grant this app access to whatever the user selects.
const APP_ID = '4779900774980'

function buildHtml(accessToken: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0">
<script>
  // Google's Picker JS only logs to a console we can't see on-device, so mirror every error
  // and console call back to React Native — this is what let us diagnose the previous SAF
  // failure quickly, and the same approach applies here.
  function report(type, message) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ log: type + ': ' + message }))
  }
  window.onerror = function (message, source, lineno, colno) {
    report('error', message + ' (' + source + ':' + lineno + ':' + colno + ')')
  }
  var origLog = console.log, origError = console.error
  console.log = function () { report('log', Array.prototype.join.call(arguments, ' ')); origLog.apply(console, arguments) }
  console.error = function () { report('error', Array.prototype.join.call(arguments, ' ')); origError.apply(console, arguments) }

  // Must be defined before the api.js <script> tag below - a plain (non-async) <script src>
  // fires its "load" event, which calls onApiLoad(), before the parser reaches any script
  // block that comes after it in the document, so defining onApiLoad afterwards left it
  // undefined at the moment it was actually needed.
  function onApiLoad() {
    report('log', 'api.js loaded, loading picker library')
    gapi.load('picker', { callback: createPicker, onerror: function (e) { report('error', 'gapi.load picker failed: ' + JSON.stringify(e)) } })
  }
  function createPicker() {
    report('log', 'picker library loaded, building picker')
    try {
      var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
      var picker = new google.picker.PickerBuilder()
        .setOAuthToken(${JSON.stringify(accessToken)})
        .setDeveloperKey(${JSON.stringify(API_KEY)})
        .setAppId(${JSON.stringify(APP_ID)})
        .addView(view)
        .setCallback(pickerCallback)
        .build()
      window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }))
      picker.setVisible(true)
    } catch (e) {
      report('error', 'building picker threw: ' + (e && e.message ? e.message : e))
    }
  }
  function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
      var doc = data.docs[0]
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: doc.id, name: doc.name }))
    } else if (data.action === google.picker.Action.CANCEL) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ cancelled: true }))
    }
  }

  report('log', 'page loaded, waiting for apis.google.com/js/api.js')
</script>
<script src="https://apis.google.com/js/api.js" onload="onApiLoad()" onerror="report('error', 'failed to load apis.google.com/js/api.js')"></script>
</body>
</html>`
}

export default function DrivePickerModal({
  accessToken,
  onPick,
  onCancel
}: {
  accessToken: string | null
  onPick: (folder: { id: string; name: string }) => void
  onCancel: () => void
}) {
  const [status, setStatus] = useState('Loading Google Picker…')
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const insets = useSafeAreaInsets()

  if (!accessToken) return null

  function handleMessage(e: WebViewMessageEvent): void {
    const data = JSON.parse(e.nativeEvent.data) as {
      id?: string
      name?: string
      cancelled?: boolean
      ready?: boolean
      log?: string
    }
    if (data.log) {
      setStatus(data.log)
      return
    }
    if (data.ready) {
      setReady(true)
      return
    }
    if (data.cancelled || !data.id || !data.name) onCancel()
    else onPick({ id: data.id, name: data.name })
  }

  function handleWebViewError(e: WebViewErrorEvent): void {
    setLoadError(`WebView failed to load: ${e.nativeEvent.description}`)
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Select your Drive folder</Text>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
        {!ready && (
          <View style={styles.statusBar}>
            <ActivityIndicator size="small" />
            <Text style={styles.statusText} numberOfLines={3}>
              {loadError ?? status}
            </Text>
          </View>
        )}
        <WebView
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          source={{ html: buildHtml(accessToken), baseUrl: 'https://apis.google.com/' }}
          onMessage={handleMessage}
          onError={handleWebViewError}
          onHttpError={(e) => setLoadError(`HTTP ${e.nativeEvent.statusCode} loading picker`)}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2'
  },
  headerText: { fontSize: 15, fontWeight: '600', color: '#111' },
  cancelText: { color: '#5b4cf0', fontSize: 14, fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  statusText: { flex: 1, fontSize: 12, color: '#555' }
})
