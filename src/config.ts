import { join } from 'path'
import pino from 'pino'
import { isValidGroupJid } from './gate.js'

export const GROUP_JID = String(process.env.TRANSCRIBE_GROUP_JID || '').trim()
export const AUTH_DIR = process.env.AUTH_DIR || join(process.cwd(), 'data', 'auth')
export const SEEN_IDS_PATH =
  process.env.SEEN_IDS_PATH || join(process.cwd(), 'data', 'seen-ids.json')
export const TRANSCRIPTS_DIR =
  process.env.TRANSCRIPTS_DIR || join(process.cwd(), 'transcripts')
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
export const WHATSAPP_CHUNK = 3500
export const FAIL_REPLY = 'Falha ao transcrever este áudio.'

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export function assertConfig(): void {
  if (!OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY is missing — set it in .env')
    process.exit(1)
  }

  if (GROUP_JID && !isValidGroupJid(GROUP_JID)) {
    logger.error(
      { value: GROUP_JID },
      'TRANSCRIBE_GROUP_JID must be a WhatsApp group id ending in @g.us (or leave empty to list groups)',
    )
    process.exit(1)
  }
}
