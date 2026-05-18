import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MxsError } from '../../src/core/errors'
import { emitError, type OutputOptions } from '../../src/core/output'

const defaultOpts: OutputOptions = {
  json: false,
  output: 'pretty-json',
  quiet: false,
  verbose: false,
}

function jsonOpts(): OutputOptions {
  return { ...defaultOpts, json: true }
}

describe('emitError — profile.write_requires_explicit JSON envelope', () => {
  let stdoutLines: string[]
  let stderrLines: string[]
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutLines = []
    stderrLines = []
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: any) => {
        stdoutLines.push(String(chunk))
        return true
      })
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('serializes the spec §4 envelope to stdout under --json', () => {
    const err = new MxsError({
      code: 'profile.write_requires_explicit',
      message: 'writing to production requires explicit acknowledgement',
      hint: 'pass --profile prod to confirm',
      details: { profile: 'prod', api_url: 'https://blog.example.com' },
    })

    emitError(err, jsonOpts())

    expect(stderrLines).toHaveLength(0)
    expect(stdoutLines).toHaveLength(1)

    const parsed = JSON.parse(stdoutLines[0]!)
    expect(parsed).toMatchObject({
      ok: false,
      error: 'profile.write_requires_explicit',
      profile: 'prod',
      api_url: 'https://blog.example.com',
      hint: 'pass --profile prod to confirm',
    })
  })

  it('writes a terse line to stderr (no JSON, no stdout) when not --json', () => {
    const err = new MxsError({
      code: 'profile.write_requires_explicit',
      message: 'writing to production requires explicit acknowledgement',
      hint: 'pass --profile prod to confirm',
      details: { profile: 'prod', api_url: 'https://blog.example.com' },
    })

    emitError(err, defaultOpts)

    expect(stdoutLines).toHaveLength(0)
    expect(stderrLines.length).toBeGreaterThan(0)
    const combined = stderrLines.join('')
    expect(combined).toContain('writing to production requires explicit acknowledgement')
    expect(() => JSON.parse(combined)).toThrow()
  })
})
