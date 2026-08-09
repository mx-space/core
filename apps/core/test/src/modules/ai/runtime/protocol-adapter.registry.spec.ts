import { describe, expect, it } from 'vitest'

import type { ProtocolAdapterResolutionError } from '~/modules/ai/runtime/protocol-adapter.registry'
import { ProtocolAdapterRegistry } from '~/modules/ai/runtime/protocol-adapter.registry'

describe('ProtocolAdapterRegistry', () => {
  it('returns the only adapter supporting the context', () => {
    const registry = new ProtocolAdapterRegistry<{ protocol: string }, string>()
      .register({
        id: 'alpha',
        matches: ({ protocol }) => protocol === 'alpha',
        create: () => 'alpha-adapter',
      })
      .register({
        id: 'beta',
        matches: ({ protocol }) => protocol === 'beta',
        create: () => 'beta-adapter',
      })

    expect(registry.resolve({ protocol: 'beta' })).toBe('beta-adapter')
  })

  it('rejects a configuration with no matching adapter', () => {
    const registry = new ProtocolAdapterRegistry<string, string>().register({
      id: 'known',
      matches: (protocol) => protocol === 'known',
      create: () => 'known-adapter',
    })

    expect(() => registry.resolve('unknown')).toThrowError(
      expect.objectContaining<Partial<ProtocolAdapterResolutionError>>({
        kind: 'not-found',
        adapterIds: [],
      }),
    )
  })

  it('rejects ambiguous matches instead of selecting by registration order', () => {
    const registry = new ProtocolAdapterRegistry<string, string>()
      .register({
        id: 'first',
        matches: () => true,
        create: () => 'first-adapter',
      })
      .register({
        id: 'second',
        matches: () => true,
        create: () => 'second-adapter',
      })

    expect(() => registry.resolve('context')).toThrowError(
      expect.objectContaining<Partial<ProtocolAdapterResolutionError>>({
        kind: 'ambiguous',
        adapterIds: ['first', 'second'],
      }),
    )
  })

  it('rejects duplicate adapter identifiers', () => {
    const registry = new ProtocolAdapterRegistry<string, string>().register({
      id: 'duplicate',
      matches: () => true,
      create: () => 'first-adapter',
    })

    expect(() =>
      registry.register({
        id: 'duplicate',
        matches: () => false,
        create: () => 'second-adapter',
      }),
    ).toThrow('Duplicate protocol adapter: duplicate')
  })
})
