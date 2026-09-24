import { Modal, View, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

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
<script src="https://apis.google.com/js/api.js" onload="onApiLoad()"></script>
<script>
  function onApiLoad() { gapi.load('picker', createPicker) }
  function createPicker() {
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
    picker.setVisible(true)
  }
  function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
      var doc = data.docs[0]
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: doc.id, name: doc.name }))
    } else if (data.action === google.picker.Action.CANCEL) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ cancelled: true }))
    }
  }
</script>
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
  if (!accessToken) return null

  function handleMessage(e: WebViewMessageEvent): void {
    const data = JSON.parse(e.nativeEvent.data) as { id?: string; name?: string; cancelled?: boolean }
    if (data.cancelled || !data.id || !data.name) onCancel()
    else onPick({ id: data.id, name: data.name })
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <WebView
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          source={{ html: buildHtml(accessToken) }}
          onMessage={handleMessage}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }
})
