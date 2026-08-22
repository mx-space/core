import { replaceFilenameTemplate } from '~/utils/filename-template.util'
import { md5 } from '~/utils/tool.util'

const SAFE_SEGMENT = /[^\w-]/g

export function resolveTtsObjectKeyPrefix(prefix?: string): string | undefined {
  if (!prefix) return undefined
  return replaceFilenameTemplate(prefix, {
    fileType: 'audio',
    originalFilename: '',
  })
}

// The speech fingerprint addresses the *text*, so on its own it would give
// re-voiced audio the key of the audio it replaces — an in-place overwrite
// behind a year-long CDN cache. The stored object is addressed by text AND by
// the voice config that produced it, and `planTts` reuses a row only when its
// storageKey equals the key this run would write, so a row left behind at
// another voice by a crashed `force` run regenerates instead of persisting.
export function computeTtsObjectFingerprint(
  speechFingerprint: string,
  voice: { model: string; voice: string; speed: number },
  synthesisProfile = 'auto:v1',
): string {
  return md5(
    `${speechFingerprint}|${voice.model}|${voice.voice}|${voice.speed}|${synthesisProfile}`,
  )
}

export function buildTtsObjectKey(input: {
  prefix?: string
  refId: string
  lang: string
  blockId: string
  chunkIndex: number
  fingerprint: string
  format?: 'mp3' | 'wav'
}): string {
  const prefix = (input.prefix ?? '').replaceAll(/^\/+|\/+$/g, '')
  const blockId = input.blockId
    .replaceAll('/', '')
    .replaceAll(SAFE_SEGMENT, '-')
  const lang = input.lang.replaceAll('/', '').replaceAll(SAFE_SEGMENT, '-')
  const format = input.format ?? 'mp3'
  const name = `${blockId}-${input.chunkIndex}-${input.fingerprint.slice(0, 12)}.${format}`
  const path = `tts/${input.refId}/${lang}/${name}`
  return prefix ? `${prefix}/${path}` : path
}
