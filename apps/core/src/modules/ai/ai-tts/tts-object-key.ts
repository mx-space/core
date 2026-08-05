const SAFE_SEGMENT = /[^\w-]/g

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
