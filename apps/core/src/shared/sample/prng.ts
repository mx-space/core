import { isDev } from '~/global/env.global'

const DEFAULT_SEED_KEY = 'MX_SAMPLE_SEED'

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rawSeed = process.env[DEFAULT_SEED_KEY] ?? String(Date.now())
const rootSeed = hashString(rawSeed)

const rngs = new Map<string, () => number>()

export function getRng(channel = 'default'): () => number {
  const cached = rngs.get(channel)
  if (cached) return cached
  const fn = mulberry32(rootSeed ^ hashString(channel))
  rngs.set(channel, fn)
  return fn
}

export function pickOne<T>(arr: readonly T[], rng = getRng()): T {
  return arr[Math.floor(rng() * arr.length)]!
}

export function pickWeighted<T>(
  entries: ReadonlyArray<readonly [T, number]>,
  rng = getRng(),
): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  const roll = rng() * total
  let cumulative = 0
  for (const [value, weight] of entries) {
    cumulative += weight
    if (roll < cumulative) return value
  }
  return entries.at(-1)![0]
}

export function rangeInt(min: number, max: number, rng = getRng()): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function rangeFloat(min: number, max: number, rng = getRng()): number {
  return rng() * (max - min) + min
}

export function shuffle<T>(arr: readonly T[], rng = getRng()): T[] {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

export const sampleSeedInfo = {
  raw: rawSeed,
  isDev,
}
