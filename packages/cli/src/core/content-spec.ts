import { promises as fs } from 'node:fs'
import path from 'node:path'

import { MxsError } from './errors'

export interface ContentSource {
  text: string
  origin: 'inline' | 'file' | 'stdin'
  path?: string
}

export async function readContentSpec(
  spec: string | undefined,
  { cwd = process.cwd() }: { cwd?: string } = {},
): Promise<ContentSource | null> {
  if (spec === undefined) return null
  if (spec === '-' || spec === 'stdin') {
    const text = await readStdin()
    return { text, origin: 'stdin' }
  }
  if (spec.startsWith('file=')) {
    const p = path.resolve(cwd, spec.slice('file='.length))
    try {
      const text = await fs.readFile(p, 'utf8')
      return { text, origin: 'file', path: p }
    } catch (err: any) {
      throw new MxsError({
        code: 'validation.failed',
        message: `failed to read ${p}: ${err?.message ?? err}`,
      })
    }
  }
  return { text: spec, origin: 'inline' }
}

export async function readJsonSpec(spec: string | undefined): Promise<unknown> {
  if (spec === undefined) return undefined
  if (spec.startsWith('file=')) {
    const p = path.resolve(process.cwd(), spec.slice('file='.length))
    try {
      const text = await fs.readFile(p, 'utf8')
      return JSON.parse(text)
    } catch (err: any) {
      throw new MxsError({
        code: 'validation.failed',
        message: `failed to read JSON from ${p}: ${err?.message ?? err}`,
      })
    }
  }
  try {
    return JSON.parse(spec)
  } catch (err: any) {
    throw new MxsError({
      code: 'validation.failed',
      message: `failed to parse JSON: ${err?.message ?? err}`,
    })
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new MxsError({
      code: 'validation.failed',
      message: 'requested stdin content but stdin is a TTY',
    })
  }
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
