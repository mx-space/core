import { describe, expect, it } from 'vitest'

import { installPKG } from '~/utils/system.util'

describe('system.util installPKG', () => {
  it('rejects unsafe package arguments before command resolution', async () => {
    await expect(installPKG('left-pad && rm -rf /', '/tmp')).rejects.toThrow(
      'Invalid package name: &&',
    )
  })
})
