/** Normalize Baileys / fetch audio payloads into a non-empty Buffer. */
export function normalizeAudioBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data) && data.length > 0) return data
  if (data instanceof Uint8Array && data.length > 0) return Buffer.from(data)
  throw new Error('empty media buffer')
}

/** True when a pipeline failure should unmark seen-ids for possible redelivery. */
export function shouldUnmarkAfterFailure(opts: {
  activeSock: unknown
  currentSock: unknown
  connectionOpen: boolean
  errText: string
}): boolean {
  if (!opts.connectionOpen) return true
  if (!opts.activeSock || opts.activeSock !== opts.currentSock) return true
  if (opts.errText.includes('socket replaced')) return true
  return false
}

export function isLiveSocket(
  activeSock: unknown,
  currentSock: unknown,
  connectionOpen: boolean,
): boolean {
  return Boolean(connectionOpen && activeSock && activeSock === currentSock)
}
