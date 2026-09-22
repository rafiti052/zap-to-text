import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLiveSocket,
  normalizeAudioBuffer,
  shouldUnmarkAfterFailure,
} from './pipeline.js'

describe('normalizeAudioBuffer', () => {
  it('accepts Buffer and Uint8Array', () => {
    const fromBuf = normalizeAudioBuffer(Buffer.from('abc'))
    assert.equal(fromBuf.toString(), 'abc')
    const fromUa = normalizeAudioBuffer(new Uint8Array([65, 66]))
    assert.equal(fromUa.toString(), 'AB')
  })

  it('rejects empty or unknown payloads', () => {
    assert.throws(() => normalizeAudioBuffer(Buffer.alloc(0)), /empty media buffer/)
    assert.throws(() => normalizeAudioBuffer(new Uint8Array()), /empty media buffer/)
    assert.throws(() => normalizeAudioBuffer(null), /empty media buffer/)
    assert.throws(() => normalizeAudioBuffer('nope'), /empty media buffer/)
  })
})

describe('isLiveSocket / shouldUnmarkAfterFailure', () => {
  const a = { id: 1 }
  const b = { id: 2 }

  it('is live only when open and same socket', () => {
    assert.equal(isLiveSocket(a, a, true), true)
    assert.equal(isLiveSocket(a, a, false), false)
    assert.equal(isLiveSocket(a, b, true), false)
    assert.equal(isLiveSocket(null, a, true), false)
  })

  it('unmarks when connection closed or socket replaced', () => {
    assert.equal(
      shouldUnmarkAfterFailure({
        activeSock: a,
        currentSock: a,
        connectionOpen: false,
        errText: 'download failed',
      }),
      true,
    )
    assert.equal(
      shouldUnmarkAfterFailure({
        activeSock: a,
        currentSock: b,
        connectionOpen: true,
        errText: 'download failed',
      }),
      true,
    )
    assert.equal(
      shouldUnmarkAfterFailure({
        activeSock: a,
        currentSock: a,
        connectionOpen: true,
        errText: 'Error: socket replaced before reply',
      }),
      true,
    )
  })

  it('keeps mark on ordinary failures while live', () => {
    assert.equal(
      shouldUnmarkAfterFailure({
        activeSock: a,
        currentSock: a,
        connectionOpen: true,
        errText: 'OpenAI transcription failed: 500',
      }),
      false,
    )
  })
})
