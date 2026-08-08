const DEFAULT_PCM_SAMPLE_RATE = 24_000
const DEFAULT_PCM_CHANNELS = 1
const PCM_BIT_DEPTH = 16

function readPositiveIntegerParameter(
  contentType: string,
  name: string,
  fallback: number,
): number {
  const match = new RegExp(`(?:^|;)\\s*${name}=(\\d+)`, 'i').exec(contentType)
  const value = Number.parseInt(match?.[1] ?? '', 10)
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

export function wrapPcmAsWav(pcm: Buffer, contentType: string): Buffer {
  const sampleRate = readPositiveIntegerParameter(
    contentType,
    'rate',
    DEFAULT_PCM_SAMPLE_RATE,
  )
  const channels = readPositiveIntegerParameter(
    contentType,
    'channels',
    DEFAULT_PCM_CHANNELS,
  )
  const header = Buffer.alloc(44)
  const blockAlign = (channels * PCM_BIT_DEPTH) / 8
  const byteRate = sampleRate * blockAlign

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(PCM_BIT_DEPTH, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}
