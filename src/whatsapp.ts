import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import qrcode from 'qrcode-terminal'
import {
  AUTH_DIR,
  FAIL_REPLY,
  GROUP_JID,
  SEEN_IDS_PATH,
  logger,
} from './config.js'
import { shouldProcessRemoteJid } from './gate.js'
import {
  isLiveSocket,
  normalizeAudioBuffer,
  shouldUnmarkAfterFailure,
} from './pipeline.js'
import { chunkText, saveTranscriptMarkdown } from './transcript.js'
import { transcribeWithWhisper } from './whisper.js'

let seenIds = new Set<string>()
let queueTail: Promise<unknown> = Promise.resolve()
let sock: WASocket | null = null
let connectionOpen = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let connecting = false

export async function loadSeenIds(): Promise<void> {
  try {
    const raw = await readFile(SEEN_IDS_PATH, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      seenIds = new Set(parsed.map(String))
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { ids?: unknown }).ids)
    ) {
      seenIds = new Set((parsed as { ids: unknown[] }).ids.map(String))
    }
    logger.info({ count: seenIds.size }, 'loaded seen ids')
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as NodeJS.ErrnoException).code
        : undefined
    if (code === 'ENOENT') {
      seenIds = new Set()
      return
    }
    logger.warn({ err: String(err) }, 'failed to load seen ids; starting empty')
    seenIds = new Set()
  }
}

async function persistSeenIds(): Promise<void> {
  await mkdir(dirname(SEEN_IDS_PATH), { recursive: true })
  const ids = [...seenIds]
  const trimmed = ids.length > 5000 ? ids.slice(-5000) : ids
  if (trimmed.length !== ids.length) {
    seenIds = new Set(trimmed)
  }
  await writeFile(SEEN_IDS_PATH, JSON.stringify({ ids: trimmed }, null, 0), 'utf8')
}

function enqueue(task: () => Promise<unknown>): Promise<unknown> {
  queueTail = queueTail.then(task, task)
  return queueTail
}

async function unmarkSeen(messageId: string): Promise<void> {
  seenIds.delete(messageId)
  try {
    await persistSeenIds()
  } catch (persistErr) {
    logger.warn({ messageId, err: String(persistErr) }, 'failed to unmark seen id')
  }
}

function assertLive(activeSock: WASocket | null, phase: string): asserts activeSock is WASocket {
  if (!isLiveSocket(activeSock, sock, connectionOpen)) {
    throw new Error(`socket replaced ${phase}`)
  }
}

async function processAudio(activeSock: WASocket | null, msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid
  const messageId = msg.key.id
  const fromMe = Boolean(msg.key.fromMe)

  if (!remoteJid) {
    logger.warn('audio without remote jid; skipping')
    return
  }

  if (!messageId) {
    logger.warn('audio without message id; skipping')
    return
  }

  if (!isLiveSocket(activeSock, sock, connectionOpen)) {
    logger.warn({ messageId }, 'socket no longer active; skip until message is resent')
    return
  }

  if (seenIds.has(messageId)) {
    logger.info({ messageId }, 'duplicate; skip')
    return
  }

  seenIds.add(messageId)
  await persistSeenIds()

  const audio = msg.message?.audioMessage
  const mimeType = audio?.mimetype || 'audio/ogg; codecs=opus'

  try {
    assertLive(activeSock, 'before download')
    logger.info({ messageId, remoteJid }, 'downloading audio')
    const raw = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: activeSock.updateMediaMessage,
      },
    )
    const buffer = normalizeAudioBuffer(raw)

    assertLive(activeSock, 'before whisper')
    logger.info({ messageId, bytes: buffer.length }, 'transcribing with whisper-1')
    const text = await transcribeWithWhisper(buffer, mimeType)

    assertLive(activeSock, 'before reply')
    const chunks = chunkText(text)
    for (const chunk of chunks) {
      assertLive(activeSock, 'before reply chunk')
      await activeSock.sendMessage(remoteJid, { text: chunk }, { quoted: msg })
    }
    logger.info({ messageId, chunks: chunks.length }, 'quoted reply sent')

    // Persist markdown only after a successful reply to avoid orphans on reconnect
    const path = await saveTranscriptMarkdown({
      transcriptionText: text,
      remoteJid,
      messageId,
      fromMe,
    })
    logger.info({ messageId, path }, 'markdown saved')
  } catch (err) {
    const errText = String(err)
    if (
      shouldUnmarkAfterFailure({
        activeSock,
        currentSock: sock,
        connectionOpen,
        errText,
      })
    ) {
      await unmarkSeen(messageId)
      logger.warn({ messageId }, 'connection lost mid-pipeline; will retry if message is redelivered')
      return
    }
    const stack = err instanceof Error ? err.stack : undefined
    logger.error({ messageId, err: errText, stack }, 'transcription pipeline failed')
    try {
      if (isLiveSocket(activeSock, sock, connectionOpen)) {
        await activeSock!.sendMessage(remoteJid, { text: FAIL_REPLY }, { quoted: msg })
      }
    } catch (sendErr) {
      logger.error({ messageId, err: String(sendErr) }, 'failed to send failure reply')
    }
  }
}

function hasAudioMessage(msg: WAMessage): boolean {
  return Boolean(msg?.message?.audioMessage)
}

function cleanupSocket(previous: WASocket | null): void {
  if (!previous) return
  try {
    previous.ev.removeAllListeners('creds.update')
    previous.ev.removeAllListeners('connection.update')
    previous.ev.removeAllListeners('messages.upsert')
  } catch {
    // ignore
  }
  try {
    previous.end(undefined)
  } catch {
    // ignore
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWhatsApp().catch((reconnectErr) => {
      logger.error({ err: String(reconnectErr) }, 'reconnect failed')
      process.exit(1)
    })
  }, 1500)
}

export async function connectWhatsApp(): Promise<void> {
  if (connecting) return
  connecting = true
  try {
    connectionOpen = false
    cleanupSocket(sock)
    sock = null

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

    const nextSock = makeWASocket({
      auth: state,
      logger,
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      syncFullHistory: false,
      getMessage: async () => undefined,
    })
    sock = nextSock

    nextSock.ev.on('creds.update', saveCreds)

    nextSock.ev.on('connection.update', (update) => {
      void (async () => {
        try {
          const { connection, lastDisconnect, qr } = update
          if (qr) {
            logger.info('Scan this QR with WhatsApp (Linked Devices):')
            qrcode.generate(qr, { small: true })
          }
          if (connection === 'open') {
            connectionOpen = true
            if (!GROUP_JID) {
              logger.warn('TRANSCRIBE_GROUP_JID is not set — listing your WhatsApp groups')
              try {
                const groups = await nextSock.groupFetchAllParticipating()
                const entries = Object.values(groups || {})
                if (!entries.length) {
                  logger.warn(
                    'No groups found. Create a WhatsApp group, then restart and set TRANSCRIBE_GROUP_JID in .env',
                  )
                } else {
                  for (const g of entries) {
                    logger.info({ name: g.subject, jid: g.id }, 'group')
                  }
                  logger.warn(
                    'Copy the jid of your transcription group into .env as TRANSCRIBE_GROUP_JID=...@g.us, then restart (./up.sh or docker compose up -d)',
                  )
                }
              } catch (err) {
                logger.error({ err: String(err) }, 'failed to list groups')
              }
              logger.warn('Audio will not be processed until TRANSCRIBE_GROUP_JID is configured')
            } else {
              logger.info({ group: GROUP_JID }, 'WhatsApp connection open')
            }
          }
          if (connection === 'close') {
            // Mark dead immediately so in-flight jobs unmark instead of burning the id
            connectionOpen = false
            const err = lastDisconnect?.error
            const statusCode = (err instanceof Boom ? err : new Boom(err))?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut
            logger.warn({ statusCode, shouldReconnect }, 'connection closed')
            if (shouldReconnect) {
              scheduleReconnect()
            } else {
              logger.error('logged out — delete data/auth and restart to get a new QR')
              process.exit(1)
            }
          }
        } catch (err) {
          const stack = err instanceof Error ? err.stack : undefined
          logger.error({ err: String(err), stack }, 'connection.update handler failed')
        }
      })()
    })

    nextSock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages || []) {
        const remoteJid = msg?.key?.remoteJid
        if (!remoteJid) continue

        if (!GROUP_JID) continue

        if (!shouldProcessRemoteJid(GROUP_JID, remoteJid)) {
          if (remoteJid.endsWith('@g.us')) {
            logger.info({ remoteJid }, 'ignored')
          }
          continue
        }

        if (!hasAudioMessage(msg)) continue

        enqueue(() => processAudio(sock, msg))
      }
    })
  } finally {
    connecting = false
  }
}
