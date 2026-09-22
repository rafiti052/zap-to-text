import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { TRANSCRIPTS_DIR, WHATSAPP_CHUNK } from './config.js'

export function safeSlug(value: string | undefined, maxLen = 40): string {
  const cleaned = String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (cleaned || 'unknown').slice(0, maxLen)
}

export function chunkText(text: string, size = WHATSAPP_CHUNK): string[] {
  const s = String(text || '').trim()
  if (!s) return []
  if (s.length <= size) return [s]
  const parts: string[] = []
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

export async function saveTranscriptMarkdown(opts: {
  transcriptionText: string
  remoteJid: string
  messageId: string
  fromMe: boolean
}): Promise<string> {
  const { transcriptionText, remoteJid, messageId, fromMe } = opts
  await mkdir(TRANSCRIPTS_DIR, { recursive: true })
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
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
