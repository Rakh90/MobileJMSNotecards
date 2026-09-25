import { readDeckFile, writeDeckFile } from './workspace'
import { SRS_DUE_KEY, SRS_EASE_KEY, SRS_INTERVAL_KEY, SRS_CORRECT_KEY, SRS_INCORRECT_KEY, SRS_LAST_KEY } from './srs'

// Wipes a deck's study progress so every card is due again. The reset is stamped with the
// current time so it wins over older grades when offline progress is merged back into Drive.
export async function resetDeckProgress(uri: string): Promise<void> {
  const db = await readDeckFile(uri)
  const rows = db.rows.map((r) => {
    const properties = { ...r.properties }
    for (const k of [SRS_DUE_KEY, SRS_EASE_KEY, SRS_INTERVAL_KEY, SRS_CORRECT_KEY, SRS_INCORRECT_KEY]) delete properties[k]
    properties[SRS_LAST_KEY] = new Date().toISOString()
    return { ...r, properties }
  })
  await writeDeckFile(uri, { ...db, rows })
}
