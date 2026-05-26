import { beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}))

vi.mock('node:child_process', async () => {
  const actual =
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process',
    )
  return { ...actual, execFile: execFileMock }
})

vi.mock('node:dns/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:dns/promises')>(
      'node:dns/promises',
    )
  return {
    ...actual,
    lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  }
})

const { AgentBrowserService } =
  await import('~/processors/agent-browser/agent-browser.service')
const { AgentBrowserSessionPool } =
  await import('~/processors/agent-browser/agent-browser-pool.service')

interface ExecFileCall {
  args: string[]
}

function setExecFileBehavior(
  cb: (call: ExecFileCall) =>
    | {
        stdout?: string
        stderr?: string
        error?: NodeJS.ErrnoException
      }
    | Promise<{
        stdout?: string
        stderr?: string
        error?: NodeJS.ErrnoException
      }>,
): void {
  execFileMock.mockImplementation((...invocationArgs: unknown[]) => {
    const args = invocationArgs[1] as string[]
    const callback = invocationArgs.at(-1) as (
      err: NodeJS.ErrnoException | null,
      result?: { stdout: string; stderr: string },
    ) => void
    Promise.resolve(cb({ args }))
      .then((res) => {
        if (res.error) {
          callback(res.error)
          return
        }
        callback(null, { stdout: res.stdout ?? '', stderr: res.stderr ?? '' })
      })
      .catch((err) => callback(err as NodeJS.ErrnoException))
    return undefined
  })
}

function parseCommand(args: string[]): string {
  for (const arg of args) {
    if (arg === 'batch' || arg === 'network' || arg === 'close') return arg
  }
  return ''
}

function navigationStdout(finalUrl: string): string {
  return JSON.stringify([
    { command: ['open', 'https://example.com'], success: true },
    { command: ['wait', '--load', 'networkidle'], success: true },
    {
      command: ['eval', '-b', '...'],
      result: { result: finalUrl },
      success: true,
    },
  ])
}

function buildService() {
  const pool = new AgentBrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
  const service = new AgentBrowserService(pool)
  return { pool, service }
}

describe('AgentBrowserService', () => {
  beforeEach(() => {
    execFileMock.mockReset()
  })

  it('queries document status against the final navigated host', async () => {
    setExecFileBehavior((call) => {
      const command = parseCommand(call.args)
      if (command === 'batch') {
        return { stdout: navigationStdout('https://target.example/final') }
      }
      if (command === 'network') {
        expect(call.args).toContain('https://target.example/**')
        return {
          stdout: JSON.stringify([
            {
              status: 404,
              url: 'https://target.example/final',
              type: 'document',
            },
          ]),
        }
      }
      return { stdout: '' }
    })

    const { pool, service } = buildService()
    const result = await service.checkUrl('https://example.com', {
      executable: '/usr/local/bin/agent-browser-fake',
      timeoutMs: 5_000,
    })

    expect(result).toEqual({
      ok: false,
      status: 404,
      finalUrl: 'https://target.example/final',
    })
    await pool.shutdown()
  })

  it('does not mark the probe healthy when document status is unavailable', async () => {
    setExecFileBehavior((call) => {
      const command = parseCommand(call.args)
      if (command === 'batch') {
        return { stdout: navigationStdout('https://example.com/') }
      }
      if (command === 'network') return { stdout: '[]' }
      return { stdout: '' }
    })

    const { pool, service } = buildService()
    const result = await service.checkUrl('https://example.com', {
      executable: '/usr/local/bin/agent-browser-fake',
      timeoutMs: 5_000,
    })

    expect(result).toEqual({
      ok: false,
      status: null,
      finalUrl: 'https://example.com/',
      error: 'agent-browser document status unavailable',
    })
    await pool.shutdown()
  })
})
