import { describe, expect, it } from 'vitest'

import {
  appleAccountTokenForReader,
  appleActivatedEvent,
  appleNotificationEventType,
  planFromAppleProductId,
} from '~/modules/membership/providers/apple-transaction'

const products = {
  monthlyProductId: 'yohaku.membership.monthly',
  yearlyProductId: 'yohaku.membership.yearly',
}

describe('appleAccountTokenForReader', () => {
  it('returns a stable UUID scoped to the reader account', () => {
    const token = appleAccountTokenForReader('reader-1')

    expect(token).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-8[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    )
    expect(appleAccountTokenForReader('reader-1')).toBe(token)
    expect(appleAccountTokenForReader('reader-2')).not.toBe(token)
  })
})

describe('planFromAppleProductId', () => {
  it('maps configured product ids', () => {
    expect(planFromAppleProductId('yohaku.membership.monthly', products)).toBe(
      'monthly',
    )
    expect(planFromAppleProductId('yohaku.membership.yearly', products)).toBe(
      'yearly',
    )
  })

  it('returns null for an unknown product', () => {
    expect(planFromAppleProductId('other.sku', products)).toBeNull()
  })
})

describe('appleActivatedEvent', () => {
  it('uses originalTransactionId as the subscription key', () => {
    const event = appleActivatedEvent(
      {
        expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
        originalTransactionId: 'orig-1',
        productId: 'yohaku.membership.yearly',
        signedDate: Date.parse('2026-08-01T00:00:00.000Z'),
        transactionId: 'txn-1',
      },
      'reader-1',
      'yearly',
    )
    expect(event).toMatchObject({
      eventId: 'txn-1',
      provider: 'apple',
      type: 'activated',
      customerId: 'orig-1',
      subscriptionId: 'orig-1',
      plan: 'yearly',
      readerId: 'reader-1',
    })
    expect(event.currentPeriodEnd.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    )
    expect(event.occurredAt?.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })
})

describe('appleNotificationEventType', () => {
  it('maps App Store notification names', () => {
    expect(appleNotificationEventType('DID_RENEW')).toBe('renewed')
    expect(appleNotificationEventType('EXPIRED')).toBe('cancelled')
    expect(appleNotificationEventType('REFUND')).toBe('cancelled')
    expect(appleNotificationEventType('REFUND_REVERSED')).toBe('renewed')
    expect(appleNotificationEventType('TEST')).toBeUndefined()
  })
})
