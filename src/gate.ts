/** Pure helpers for group JID validation and privacy gate. */
export function isValidGroupJid(jid: string | null | undefined): boolean {
  const s = String(jid || '').trim()
  // WhatsApp group JIDs: digits, optional -digits, then @g.us
  return /^[0-9]+(-[0-9]+)?@g\.us$/.test(s)
}

/** True only when the configured group is set and matches remoteJid exactly. */
export function shouldProcessRemoteJid(
  groupJid: string | null | undefined,
  remoteJid: string | null | undefined,
): boolean {
  const group = String(groupJid || '').trim()
  const remote = String(remoteJid || '').trim()
  if (!group || !remote) return false
  return remote === group
}
