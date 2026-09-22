import { OPENAI_API_KEY } from './config.js'

export async function transcribeWithWhisper(
  buffer: Buffer,
  mimeType: string | undefined,
): Promise<string> {
  const form = new FormData()
  const ext = (mimeType || '').includes('ogg')
    ? 'ogg'
    : (mimeType || '').includes('mpeg') || (mimeType || '').includes('mp3')
      ? 'mp3'
      : (mimeType || '').includes('mp4') || (mimeType || '').includes('m4a')
        ? 'm4a'
        : 'ogg'
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'audio/ogg' })
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

  const data = (await res.json()) as { text?: string }
  const text = data?.text || ''
  if (!String(text).trim()) {
    throw new Error('OpenAI returned empty transcription')
  }
  return String(text)
}
