/**
 * Pure helpers for group JID validation and privacy gate.
 * @param {string} jid
 * @returns {boolean}
 */
export function isValidGroupJid(jid) {
  const s = String(jid || '').trim()
  // WhatsApp group JIDs: digits, optional -digits, then @g.us
  return /^[0-9]+(-[0-9]+)?@g\.us$/.test(s)
}

/**
 * True only when the configured group is set and matches remoteJid exactly.
 * @param {string} groupJid
 * @param {string} remoteJid
 * @returns {boolean}
 */
export function shouldProcessRemoteJid(groupJid, remoteJid) {
  const group = String(groupJid || '').trim()
  const remote = String(remoteJid || '').trim()
  if (!group || !remote) return false
  return remote === group
}
