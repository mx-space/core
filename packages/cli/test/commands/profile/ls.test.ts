import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '../../../src/commands/profile/ls'
import type { OutputOptions } from '../../../src/core/output'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-ls-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = origXdg
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function mxsDir() {
  return path.join(tmpDir, 'mxs')
}

async function makeProfile(name: string, cfg: Record<string, unknown> = {}) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(cfg))
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

const out: OutputOptions = { json: true, output: 'json', quiet: true, verbose: false }
const outReadable: OutputOptions = { json: false, output: 'readable', quiet: false, verbose: false }

describe('profile ls', () => {
  it('outputs empty array when no profiles exist', async () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run({}, out)
    spy.mockRestore()
    const result = JSON.parse(writes.join(''))
    expect(result).toMatchObject({ ok: true, data: [] })
  })

  it('lists profiles with current marker', async () => {
    await makeProfile('dev', { api_url: 'http://dev.local', production: false })
    await makeProfile('prod', { api_url: 'https://prod.example.com', production: true })
    await setCurrent('dev')

    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run({}, out)
    spy.mockRestore()

    const result = JSON.parse(writes.join(''))
    expect(result.ok).toBe(true)
    const rows: any[] = result.data
    const devRow = rows.find((r: any) => r.name === 'dev')
    const prodRow = rows.find((r: any) => r.name === 'prod')
    expect(devRow.current).toBe('*')
    expect(prodRow.current).toBe('')
    expect(devRow.api_url).toBe('http://dev.local')
    expect(prodRow.production).toBe('yes')
    expect(devRow.production).toBe('no')
  })

  it('outputs table in readable mode', async () => {
    await makeProfile('dev', { api_url: 'http://dev.local' })
    await setCurrent('dev')

    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run({}, outReadable)
    spy.mockRestore()

    const output = writes.join('')
    expect(output).toContain('dev')
    expect(output).toContain('*')
  })

  it('outputs (no profiles) message when empty in readable mode', async () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run({}, outReadable)
    spy.mockRestore()
    expect(writes.join('')).toContain('no profiles')
  })
})
