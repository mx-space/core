import { describe, expect, it } from 'vitest'

import { wrapPcmAsWav } from '~/modules/ai/ai-tts/tts-audio'

describe('wrapPcmAsWav', () => {
  it('preserves PCM samples and describes the provider sample format', () => {
    const pcm = Buffer.from([1, 0, 2, 0])
    const wav = wrapPcmAsWav(pcm, 'audio/pcm;rate=24000;channels=1')

    expect(wav.subarray(0, 4).toString()).toBe('RIFF')
    expect(wav.subarray(8, 12).toString()).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(24_000)
    expect(wav.readUInt16LE(34)).toBe(16)
    expect(wav.readUInt32LE(40)).toBe(pcm.length)
    expect(wav.subarray(44)).toEqual(pcm)
  })
})
