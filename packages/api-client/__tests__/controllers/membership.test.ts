import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { MembershipController } from '~/controllers'

describe('test Membership client', () => {
  const client = mockRequestInstance(MembershipController)

  test('POST /membership/checkout', async () => {
    const mocked = mockResponse(
      '/membership/checkout',
      { checkout_url: 'https://pay.example.com/session/abc' },
      'post',
      { plan: 'monthly' },
    )

    const data = await client.membership.checkout('monthly')
    expect(data).toEqual({ checkoutUrl: mocked.checkout_url })
  })

  test('GET /membership/status returns active membership', async () => {
    const mocked = mockResponse('/membership/status', {
      status: 'active',
      plan: 'yearly',
      provider: 'dodo',
      current_period_end: '2027-07-18T00:00:00.000Z',
    })

    const data = await client.membership.status()
    expect(data).toEqual({
      status: 'active',
      plan: 'yearly',
      provider: 'dodo',
      currentPeriodEnd: mocked.current_period_end,
    })
  })

  test('GET /membership/status returns none for non-members', async () => {
    mockResponse('/membership/status', { status: 'none' })

    const data = await client.membership.status()
    expect(data).toEqual({ status: 'none' })
  })
})
