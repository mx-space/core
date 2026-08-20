import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppleProvider } from '~/modules/membership/providers/apple.provider'

const get = vi.fn()

describe('AppleProvider.createCheckout', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('refuses web checkout', async () => {
    const provider = new AppleProvider({ get } as any)
    await expect(
      provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'monthly',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED,
    })
  })
})
