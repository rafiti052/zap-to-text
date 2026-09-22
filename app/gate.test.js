import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidGroupJid, shouldProcessRemoteJid } from './gate.js'

describe('isValidGroupJid', () => {
  it('accepts group jids ending in @g.us', () => {
    assert.equal(isValidGroupJid('120363@g.us'), true)
    assert.equal(isValidGroupJid(' 120363456789@g.us '), true)
  })

  it('rejects empty, DMs, and other suffixes', () => {
    assert.equal(isValidGroupJid(''), false)
    assert.equal(isValidGroupJid('   '), false)
    assert.equal(isValidGroupJid('5511999999999@s.whatsapp.net'), false)
    assert.equal(isValidGroupJid('120363@c.us'), false)
    assert.equal(isValidGroupJid('not-a-jid'), false)
  })
})

describe('shouldProcessRemoteJid', () => {
  const group = '120363@g.us'

  it('processes only the configured group', () => {
    assert.equal(shouldProcessRemoteJid(group, group), true)
  })

  it('rejects when group is unset', () => {
    assert.equal(shouldProcessRemoteJid('', group), false)
    assert.equal(shouldProcessRemoteJid(null, group), false)
  })

  it('rejects other groups and DMs', () => {
    assert.equal(shouldProcessRemoteJid(group, '999@g.us'), false)
    assert.equal(shouldProcessRemoteJid(group, '5511@s.whatsapp.net'), false)
    assert.equal(shouldProcessRemoteJid(group, ''), false)
  })
})
