import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const BIN = fileURLToPath(
  new URL('../../../cli/src/bin/mxs.ts', import.meta.url),
)
const tsxLoader = import.meta.resolve('tsx')

export type OutputMode = 'json' | 'pretty-json' | 'readable' | 'llm' | 'xml'

export interface MxsResult {
  code: number | null
  stdout: string
  stderr: string
}

export function injectModeFlags(
  args: readonly string[],
  mode: OutputMode,
): readonly string[] {
  if (mode === 'readable') return args
  if (mode === 'json') return [...args, '--json']
  return [...args, '--output', mode]
}

export interface SpawnedMxs {
  child: ReturnType<typeof spawn>
  result: Promise<MxsResult>
  waitForStdoutLine: (
    predicate: (line: string) => boolean,
    timeoutMs?: number,
  ) => Promise<string>
}

export function spawnMxs(
  args: readonly string[],
  env: Record<string, string> = {},
): SpawnedMxs {
  const child = spawn(process.execPath, ['--import', tsxLoader, BIN, ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  const lineWaiters: Array<{
    predicate: (line: string) => boolean
    resolve: (line: string) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
  }> = []
  let stdoutText = ''

  const inspectLines = () => {
    const lines = stdoutText.split(/\r?\n/).filter(Boolean)
    for (const waiter of lineWaiters) {
      const match = lines.find(waiter.predicate)
      if (!match) continue
      clearTimeout(waiter.timer)
      lineWaiters.splice(lineWaiters.indexOf(waiter), 1)
      waiter.resolve(match)
    }
  }

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutChunks.push(chunk)
    stdoutText += chunk.toString('utf8')
    inspectLines()
  })
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

  const result = new Promise<MxsResult>((resolve) => {
    child.on('exit', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8')
      const stderr = Buffer.concat(stderrChunks).toString('utf8')
      for (const waiter of lineWaiters.splice(0)) {
        clearTimeout(waiter.timer)
        waiter.reject(
          new Error(
            `mxs exited before expected stdout line\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        )
      }
      resolve({ code, stdout, stderr })
    })
  })

  return {
    child,
    result,
    waitForStdoutLine(predicate, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = lineWaiters.findIndex((w) => w.timer === timer)
          if (index >= 0) lineWaiters.splice(index, 1)
          reject(
            new Error(
              `timed out waiting for mxs stdout line\nstdout:\n${stdoutText}`,
            ),
          )
        }, timeoutMs)
        lineWaiters.push({ predicate, resolve, reject, timer })
        inspectLines()
      })
    },
  }
}

export async function runMxs(
  args: readonly string[],
  env: Record<string, string> = {},
  optsOrTimeout: { timeoutMs?: number; mode?: OutputMode } | number = 30_000,
): Promise<MxsResult> {
  const opts =
    typeof optsOrTimeout === 'number'
      ? { timeoutMs: optsOrTimeout }
      : optsOrTimeout
  const timeoutMs = opts.timeoutMs ?? 30_000
  const finalArgs = opts.mode ? injectModeFlags(args, opts.mode) : args
  const spawned = spawnMxs(finalArgs, env)
  const timer = setTimeout(() => {
    spawned.child.kill('SIGKILL')
  }, timeoutMs)
  try {
    return await spawned.result
  } finally {
    clearTimeout(timer)
  }
}

export function parseEnvelope(stdout: string): {
  ok: boolean
  data?: unknown
  code?: string
  message?: string
} {
  const line = stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith('{') && item.endsWith('}'))

  if (!line) {
    throw new Error(`no JSON envelope in stdout:\n${stdout}`)
  }

  return JSON.parse(line)
}

export function extractId(value: unknown): string {
  if (!value || typeof value !== 'object') {
    throw new Error(`response has no id: ${JSON.stringify(value)}`)
  }
  const record = value as Record<string, unknown>
  const id = record.id ?? record._id
  if (typeof id === 'string') return id
  if (record.data) return extractId(record.data)
  throw new Error(`response has no id: ${JSON.stringify(value)}`)
}

export function getItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.data)) return record.data
  return []
}

export function getPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if ('data' in record) return record.data
  return value
}
