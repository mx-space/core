import { afterEach, describe, expect, it, vi } from 'vitest'

import { MxsError } from '../../../src/core/errors'
import type { OutputOptions } from '../../../src/core/output'

const mocks = vi.hoisted(() => ({
  resolveConfig: vi.fn(),
  runOnboarding: vi.fn(),
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
}))

vi.mock('../../../src/core/config-store', () => ({
  readConfig: mocks.readConfig,
  resolveConfig: mocks.resolveConfig,
  writeConfig: mocks.writeConfig,
}))

vi.mock('../../../src/core/onboarding', () => ({
  runOnboarding: mocks.runOnboarding,
}))

const { resolveContext } = await import('../../../src/commands/internal/shared')

const out: OutputOptions = {
  json: false,
  output: 'readable',
  quiet: true,
  verbose: false,
}

describe('resolveContext', () => {
  afterEach(() => {
    delete process.env.MXS_PROFILE
    vi.clearAllMocks()
  })

  it('passes --profile into onboarding fallback', async () => {
    mocks.resolveConfig
      .mockRejectedValueOnce(
        new MxsError({
          code: 'config.missing.api_url',
          message: 'missing',
        }),
      )
      .mockResolvedValueOnce({
        apiUrl: 'https://blog.example.com',
        profileName: 'dev',
      })
    mocks.runOnboarding.mockResolvedValue({
      apiUrl: 'https://blog.example.com',
    })

    const result = await resolveContext({ profile: 'dev' }, out)

    expect(mocks.runOnboarding).toHaveBeenCalledWith({ profile: 'dev' })
    expect(result.profileName).toBe('dev')
  })

  it('passes MXS_PROFILE into onboarding fallback', async () => {
    process.env.MXS_PROFILE = 'staging'
    mocks.resolveConfig
      .mockRejectedValueOnce(
        new MxsError({
          code: 'config.missing.api_url',
          message: 'missing',
        }),
      )
      .mockResolvedValueOnce({
        apiUrl: 'https://blog.example.com',
        profileName: 'staging',
      })
    mocks.runOnboarding.mockResolvedValue({
      apiUrl: 'https://blog.example.com',
    })

    await resolveContext({}, out)

    expect(mocks.runOnboarding).toHaveBeenCalledWith({ profile: 'staging' })
  })
})
