import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import qrcode from 'qrcode-terminal'
import pino from 'pino'

const GROUP_JID = process.env.TRANSCRIBE_GROUP_JID || '120363412859178311@g.us'
const AUTH_DIR = process.env.AUTH_DIR || join(process.cwd(), 'data', 'auth')
const SEEN_IDS_PATH = process.env.SEEN_IDS_PATH || join(process.cwd(), 'data', 'seen-ids.json')
const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || join(process.cwd(), 'transcripts')
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const WHATSAPP_CHUNK = 3500
const FAIL_REPLY = 'Falha ao transcrever este áudio.'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

if (!OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY is missing — set it in .env')
  process.exit(1)
}

/** @type {Set<string>} */
let seenIds = new Set()
/** @type {Promise<void>} */
let queueTail = Promise.resolve()

async function loadSeenIds() {
  try {
    const raw = await readFile(SEEN_IDS_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      seenIds = new Set(parsed.map(String))
    } else if (parsed && Array.isArray(parsed.ids)) {
      seenIds = new Set(parsed.ids.map(String))
    }
    logger.info({ count: seenIds.size }, 'loaded seen ids')
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      seenIds = new Set()
      return
    }
    logger.warn({ err: String(err) }, 'failed to load seen ids; starting empty')
    seenIds = new Set()
  }
}

async function persistSeenIds() {
  await mkdir(dirname(SEEN_IDS_PATH), { recursive: true })
  const ids = [...seenIds]
  // Cap growth: keep the most recent ~5000
  const trimmed = ids.length > 5000 ? ids.slice(-5000) : ids
  if (trimmed.length !== ids.length) {
    seenIds = new Set(trimmed)
  }
  await writeFile(SEEN_IDS_PATH, JSON.stringify({ ids: trimmed }, null, 0), 'utf8')
}

function enqueue(task) {
  queueTail = queueTail.then(task, task)
  return queueTail
}

function safeSlug(value, maxLen = 40) {
  const cleaned = String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (cleaned || 'unknown').slice(0, maxLen)
}

function chunkText(text, size = WHATSAPP_CHUNK) {
  const s = String(text || '').trim()
  if (!s) return []
  if (s.length <= size) return [s]
  const parts = []
  let i = 0
  while (i < s.length) {
    let end = Math.min(i + size, s.length)
    if (end < s.length) {
      const slice = s.slice(i, end)
      const breakAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '))
      if (breakAt > size * 0.5) end = i + breakAt
    }
    parts.push(s.slice(i, end).trim())
    i = end
  }
  return parts.filter(Boolean)
}

async function saveTranscriptMarkdown({
  transcriptionText,
  remoteJid,
  messageId,
  fromMe,
}) {
  await mkdir(TRANSCRIPTS_DIR, { recursive: true })
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const contact = (remoteJid || '').split('@')[0] || 'unknown'
  const filename = `${stamp}-${safeSlug(contact)}-${safeSlug(messageId, 12)}.md`
  const path = join(TRANSCRIPTS_DIR, filename)
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const body = `---
date: ${iso}
contact: ${contact}
remote_jid: ${remoteJid}
message_id: ${messageId}
from_me: ${fromMe ? 'true' : 'false'}
instance: zap-to-text
---

# Transcrição WhatsApp

## Transcrição

${String(transcriptionText || '').trim()}
`
  await writeFile(path, body, 'utf8')
  return path
}

async function transcribeWithWhisper(buffer, mimeType) {
  const form = new FormData()
  const ext = (mimeType || '').includes('ogg')
    ? 'ogg'
    : (mimeType || '').includes('mpeg') || (mimeType || '').includes('mp3')
      ? 'mp3'
      : (mimeType || '').includes('mp4') || (mimeType || '').includes('m4a')
        ? 'm4a'
        : 'ogg'
  const blob = new Blob([buffer], { type: mimeType || 'audio/ogg' })
  form.append('file', blob, `audio.${ext}`)
  form.append('model', 'whisper-1')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI transcription failed: ${res.status} ${detail.slice(0, 500)}`)
  }

  const data = await res.json()
  const text = (data && data.text) || ''
  if (!String(text).trim()) {
    throw new Error('OpenAI returned empty transcription')
  }
  return String(text)
}

async function processAudio(sock, msg) {
  const remoteJid = msg.key.remoteJid
  const messageId = msg.key.id
  const fromMe = Boolean(msg.key.fromMe)

  if (!messageId) {
    logger.warn('audio without message id; skipping')
    return
  }

  if (seenIds.has(messageId)) {
    logger.info({ messageId }, 'duplicate; skip')
    return
  }

  // Mark at START so failures do not loop
  seenIds.add(messageId)
  await persistSeenIds()

  const audio = msg.message?.audioMessage
  const mimeType = audio?.mimetype || 'audio/ogg; codecs=opus'

  try {
    logger.info({ messageId, remoteJid }, 'downloading audio')
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: sock.updateMediaMessage,
      },
    )

    if (!buffer || !buffer.length) {
      throw new Error('empty media buffer')
    }

    logger.info({ messageId, bytes: buffer.length }, 'transcribing with whisper-1')
    const text = await transcribeWithWhisper(buffer, mimeType)

    const path = await saveTranscriptMarkdown({
      transcriptionText: text,
      remoteJid,
      messageId,
      fromMe,
    })
    logger.info({ messageId, path }, 'markdown saved')

    const chunks = chunkText(text)
    for (const chunk of chunks) {
      await sock.sendMessage(remoteJid, { text: chunk }, { quoted: msg })
    }
    logger.info({ messageId, chunks: chunks.length }, 'quoted reply sent')
  } catch (err) {
    logger.error({ messageId, err: String(err), stack: err?.stack }, 'transcription pipeline failed')
    try {
      await sock.sendMessage(remoteJid, { text: FAIL_REPLY }, { quoted: msg })
    } catch (sendErr) {
      logger.error({ messageId, err: String(sendErr) }, 'failed to send failure reply')
    }
  }
}

function hasAudioMessage(msg) {
  return Boolean(msg?.message?.audioMessage)
}

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  const sock = makeWASocket({
    auth: state,
    logger,
    markOnlineOnConnect: false,
    printQRInTerminal: false,
    syncFullHistory: false,
    getMessage: async () => undefined,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      logger.info('Scan this QR with WhatsApp (Linked Devices):')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') {
      logger.info({ group: GROUP_JID }, 'WhatsApp connection open')
    }
    if (connection === 'close') {
      const err = lastDisconnect?.error
      const statusCode = (err instanceof Boom ? err : new Boom(err))?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      logger.warn({ statusCode, shouldReconnect }, 'connection closed')
      if (shouldReconnect) {
        setTimeout(() => {
          connectWhatsApp().catch((reconnectErr) => {
            logger.error({ err: String(reconnectErr) }, 'reconnect failed')
            process.exit(1)
          })
        }, 1500)
      } else {
        logger.error('logged out — delete data/auth and restart to get a new QR')
        process.exit(1)
      }
    }
  })

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages || []) {
      const remoteJid = msg?.key?.remoteJid
      if (!remoteJid) continue

      if (remoteJid !== GROUP_JID) {
        logger.info({ remoteJid }, 'ignored')
        continue
      }

      if (!hasAudioMessage(msg)) {
        // Group non-audio: discard quietly (no content logs)
        continue
      }

      // Serial queue: one audio at a time
      enqueue(() => processAudio(sock, msg))
    }
  })
}

async function main() {
  await mkdir(AUTH_DIR, { recursive: true })
  await mkdir(TRANSCRIPTS_DIR, { recursive: true })
  await mkdir(dirname(SEEN_IDS_PATH), { recursive: true })
  await loadSeenIds()
  await connectWhatsApp()
}

main().catch((err) => {
  logger.error({ err: String(err), stack: err?.stack }, 'fatal')
  process.exit(1)
})
