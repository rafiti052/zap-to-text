/**
 * Pure helpers for group JID validation and privacy gate.
 * @param {string} jid
 * @returns {boolean}
 */
export function isValidGroupJid(jid) {
  const s = String(jid || '').trim()
  return s.length > 0 && s.endsWith('@g.us')
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
