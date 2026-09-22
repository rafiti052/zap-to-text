import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import {
  AUTH_DIR,
  SEEN_IDS_PATH,
  TRANSCRIPTS_DIR,
  assertConfig,
  logger,
} from './config.js'
import { connectWhatsApp, loadSeenIds } from './whatsapp.js'

async function main(): Promise<void> {
  assertConfig()
  await mkdir(AUTH_DIR, { recursive: true })
  await mkdir(TRANSCRIPTS_DIR, { recursive: true })
  await mkdir(dirname(SEEN_IDS_PATH), { recursive: true })
  await loadSeenIds()
  await connectWhatsApp()
}

main().catch((err: unknown) => {
  const stack = err instanceof Error ? err.stack : undefined
  logger.error({ err: String(err), stack }, 'fatal')
  process.exit(1)
})
