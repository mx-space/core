import { expect } from 'vitest'

import { injectModeFlags, type MxsResult, type OutputMode, runMxs } from './mxs'

export interface ModeSupport {
  json?: boolean
  prettyJson?: boolean
  readable?: boolean
  llm?: boolean
  xml?: boolean
}

export interface ModeAssertions {
  json?: (envelope: { ok: boolean; data: unknown }, raw: MxsResult) => void
  prettyJson?: (parsed: unknown, raw: MxsResult) => void
  readable?: (stdout: string, raw: MxsResult) => void
  llm?: (stdout: string, raw: MxsResult) => void
  xml?: (stdout: string, raw: MxsResult) => void
}

const ALL_MODES: ReadonlyArray<keyof ModeSupport> = [
  'json',
  'prettyJson',
  'readable',
  'llm',
  'xml',
]

const MODE_TO_FLAG: Record<keyof ModeSupport, OutputMode> = {
  json: 'json',
  prettyJson: 'pretty-json',
  readable: 'readable',
  llm: 'llm',
  xml: 'xml',
}

const DEFAULT_SUPPORT: Required<ModeSupport> = {
  json: true,
  prettyJson: true,
  readable: true,
  llm: false,
  xml: false,
}

const ESC = String.fromCharCode(27)
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m`, 'g')

const stripAnsi = (s: string): string => s.replaceAll(ANSI_RE, '')

export async function runAcrossModes(
  baseArgs: readonly string[],
  env: Record<string, string>,
  supports: ModeSupport,
  assertions: ModeAssertions,
  opts?: { timeoutMs?: number },
): Promise<void> {
  const fullSupport: Required<ModeSupport> = { ...DEFAULT_SUPPORT, ...supports }
  for (const key of ALL_MODES) {
    const mode = MODE_TO_FLAG[key]
    const args = injectModeFlags(baseArgs, mode)
    const result = await runMxs(args, env, { timeoutMs: opts?.timeoutMs })

    if (fullSupport[key]) {
      expect(
        result.code,
        `mode=${mode} exited non-zero. stderr=${result.stderr}`,
      ).toBe(0)
      runAssertion(key, result, assertions)
    } else {
      expect(
        result.code,
        `mode=${mode} expected exit 0 with unsupported warning. stderr=${result.stderr}`,
      ).toBe(0)
      expect(
        stripAnsi(result.stderr),
        `mode=${mode} expected unsupported-warning on stderr`,
      ).toMatch(/unsupported --output value for/)
      expect(
        stripAnsi(result.stdout).trim(),
        `mode=${mode} expected empty stdout on unsupported`,
      ).toBe('')
    }
  }
}

function runAssertion(
  key: keyof ModeSupport,
  result: MxsResult,
  assertions: ModeAssertions,
): void {
  switch (key) {
    case 'json': {
      const line = result.stdout.trim().split(/\r?\n/).pop() ?? ''
      const envelope = JSON.parse(line) as { ok: boolean; data: unknown }
      expect(typeof envelope.ok).toBe('boolean')
      assertions.json?.(envelope, result)
      break
    }
    case 'prettyJson': {
      const parsed = JSON.parse(result.stdout)
      expect(result.stdout.includes('\n')).toBe(true)
      assertions.prettyJson?.(parsed, result)
      break
    }
    case 'readable': {
      assertions.readable?.(result.stdout, result)
      break
    }
    case 'llm': {
      const clean = stripAnsi(result.stdout)
      expect(clean).toBe(result.stdout)
      assertions.llm?.(result.stdout, result)
      break
    }
    case 'xml': {
      expect(result.stdout.trim().startsWith('<')).toBe(true)
      expect(result.stdout.trim().endsWith('>')).toBe(true)
      assertions.xml?.(result.stdout, result)
      break
    }
  }
}
