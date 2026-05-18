import { describe, expect, it } from 'vitest'

import {
  decideWriteGate,
  type HttpMethod,
  type ResolvedGateInput,
} from '../../src/domain/gate'

function makeResolved(
  overrides: Partial<ResolvedGateInput> = {},
): ResolvedGateInput {
  return {
    apiUrl: overrides.apiUrl ?? 'https://blog.example.com',
    profileName:
      'profileName' in overrides ? (overrides.profileName as string | null) : 'prod',
    isProduction: overrides.isProduction ?? false,
    profileExplicit: overrides.profileExplicit ?? false,
    urlOverridden: overrides.urlOverridden ?? false,
  }
}

describe('decideWriteGate — safe methods always allow', () => {
  it.each<HttpMethod>(['GET', 'HEAD', 'OPTIONS'])(
    'allows %s even on production without explicit profile',
    (method) => {
      const resolved = makeResolved({ isProduction: true })
      expect(decideWriteGate(resolved, method).allow).toBe(true)
    },
  )
})

describe('decideWriteGate — non-production always allow', () => {
  it.each<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s when isProduction is false',
    (method) => {
      const resolved = makeResolved({ isProduction: false })
      expect(decideWriteGate(resolved, method).allow).toBe(true)
    },
  )
})

describe('decideWriteGate — explicit profile bypasses gate', () => {
  it.each<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s when profileExplicit is true',
    (method) => {
      const resolved = makeResolved({
        isProduction: true,
        profileExplicit: true,
      })
      expect(decideWriteGate(resolved, method).allow).toBe(true)
    },
  )
})

describe('decideWriteGate — URL override bypasses gate', () => {
  it.each<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s when urlOverridden is true',
    (method) => {
      const resolved = makeResolved({
        isProduction: true,
        urlOverridden: true,
      })
      expect(decideWriteGate(resolved, method).allow).toBe(true)
    },
  )
})

describe('decideWriteGate — production + implicit selection → refuse', () => {
  it.each<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'refuses %s on production profile selected implicitly',
    (method) => {
      const resolved = makeResolved({
        isProduction: true,
        profileExplicit: false,
        urlOverridden: false,
        profileName: 'prod',
        apiUrl: 'https://blog.example.com',
      })
      const decision = decideWriteGate(resolved, method)
      expect(decision.allow).toBe(false)
      expect(decision.message).toContain('prod')
      expect(decision.message).toContain('https://blog.example.com')
    },
  )
})

describe('decideWriteGate — refusal message format', () => {
  it('includes profile name and api url in message', () => {
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: false,
      urlOverridden: false,
      profileName: 'prod',
      apiUrl: 'https://blog.example.com',
    })
    const decision = decideWriteGate(resolved, 'POST')
    expect(decision.message).toContain('prod')
    expect(decision.message).toContain('https://blog.example.com')
  })

  it('hint instructs to use --profile or MXS_PROFILE', () => {
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: false,
      urlOverridden: false,
      profileName: 'myprod',
      apiUrl: 'https://blog.example.com',
    })
    const decision = decideWriteGate(resolved, 'DELETE')
    expect(decision.hint).toMatch(/--profile myprod/)
    expect(decision.hint).toMatch(/MXS_PROFILE=myprod/)
  })

  it('matches spec hint format exactly', () => {
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: false,
      urlOverridden: false,
      profileName: 'prod',
    })
    const decision = decideWriteGate(resolved, 'PATCH')
    expect(decision.hint).toBe(
      "active profile 'prod' is production; retry with --profile prod or MXS_PROFILE=prod",
    )
  })

  it('uses "unknown" when profileName is null', () => {
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: false,
      urlOverridden: false,
      profileName: null,
    })
    const decision = decideWriteGate(resolved, 'POST')
    expect(decision.message).toContain('unknown')
  })
})

describe('decideWriteGate — all four conditions must hold to refuse', () => {
  it('allows when only isProduction=true but urlOverridden=true', () => {
    const resolved = makeResolved({
      isProduction: true,
      urlOverridden: true,
      profileExplicit: false,
    })
    expect(decideWriteGate(resolved, 'POST').allow).toBe(true)
  })

  it('allows when isProduction=true and profileExplicit=true', () => {
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: true,
      urlOverridden: false,
    })
    expect(decideWriteGate(resolved, 'DELETE').allow).toBe(true)
  })

  it('allows when isProduction=false regardless of explicitness', () => {
    const resolved = makeResolved({
      isProduction: false,
      profileExplicit: false,
      urlOverridden: false,
    })
    expect(decideWriteGate(resolved, 'PUT').allow).toBe(true)
  })
})
