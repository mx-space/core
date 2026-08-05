import { md5 } from '~/utils/tool.util'

const SAFE_SEGMENT = /[^\w-]/g

// The speech fingerprint addresses the *text*, so on its own it would give
// re-voiced audio the key of the audio it replaces — an in-place overwrite
// behind a year-long CDN cache. The stored object is addressed by text AND by
// the voice config that produced it; reuse still keys on the speech
// fingerprint alone, because a run only adopts new voice config under `force`.
export function computeTtsObjectFingerprint(
  speechFingerprint: string,
  voice: { model: string; voice: string; speed: number },
): string {
  return md5(
    `${speechFingerprint}|${voice.model}|${voice.voice}|${voice.speed}`,
  )
}

export function buildTtsObjectKey(input: {
  prefix?: string
  refId: string
  lang: string
  blockId: string
  chunkIndex: number
  fingerprint: string
}): string {
  const prefix = (input.prefix ?? '').replaceAll(/^\/+|\/+$/g, '')
  const blockId = input.blockId
    .replaceAll('/', '')
    .replaceAll(SAFE_SEGMENT, '-')
  const lang = input.lang.replaceAll('/', '').replaceAll(SAFE_SEGMENT, '-')
  const name = `${blockId}-${input.chunkIndex}-${input.fingerprint.slice(0, 12)}.mp3`
  const path = `tts/${input.refId}/${lang}/${name}`
  return prefix ? `${prefix}/${path}` : path
}
