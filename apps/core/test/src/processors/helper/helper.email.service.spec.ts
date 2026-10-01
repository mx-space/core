import { describe, expect, it } from 'vitest'

import { EmailService } from '~/processors/helper/helper.email.service'

type Normalizers = {
  normalizeSingleAddress: (input: unknown) => string | undefined
  normalizeAddressList: (input: unknown) => string | string[] | undefined
}

const service = Object.create(EmailService.prototype) as Normalizers

describe('EmailService address normalization', () => {
  it('flattens nested nodemailer address inputs', () => {
    expect(
      service.normalizeAddressList([
        'a@x.com',
        [{ name: 'B', address: 'b@x.com' }, ['c@x.com']],
        { name: 'no address' },
      ]),
    ).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
  })

  it('collapses a single address and drops empty input', () => {
    expect(service.normalizeAddressList([{ address: 'a@x.com' }])).toBe(
      'a@x.com',
    )
    expect(service.normalizeAddressList([])).toBeUndefined()
    expect(service.normalizeAddressList(undefined)).toBeUndefined()
  })

  it('picks the first usable address for single fields', () => {
    expect(
      service.normalizeSingleAddress([{ name: 'x' }, [{ address: 'b@x.com' }]]),
    ).toBe('b@x.com')
    expect(service.normalizeSingleAddress('a@x.com')).toBe('a@x.com')
  })
})
