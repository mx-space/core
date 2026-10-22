export interface ProtocolAdapterRegistration<TContext, TAdapter> {
  create: (context: TContext) => TAdapter
  id: string
  matches: (context: TContext) => boolean
}

export class ProtocolAdapterResolutionError extends Error {
  constructor(
    readonly kind: 'ambiguous' | 'not-found',
    readonly adapterIds: string[],
  ) {
    super(
      kind === 'not-found'
        ? 'No protocol adapter supports the runtime configuration'
        : `Multiple protocol adapters support the runtime configuration: ${adapterIds.join(', ')}`,
    )
    this.name = 'ProtocolAdapterResolutionError'
  }
}

export class ProtocolAdapterRegistry<TContext, TAdapter> {
  private readonly registrations: Array<
    ProtocolAdapterRegistration<TContext, TAdapter>
  > = []

  register(
    registration: ProtocolAdapterRegistration<TContext, TAdapter>,
  ): this {
    if (this.registrations.some(({ id }) => id === registration.id)) {
      throw new Error(`Duplicate protocol adapter: ${registration.id}`)
    }
    this.registrations.push(registration)
    return this
  }

  resolve(context: TContext): TAdapter {
    const matches = this.registrations.filter((registration) =>
      registration.matches(context),
    )
    if (matches.length !== 1) {
      throw new ProtocolAdapterResolutionError(
        matches.length === 0 ? 'not-found' : 'ambiguous',
        matches.map(({ id }) => id),
      )
    }
    return matches[0].create(context)
  }
}
