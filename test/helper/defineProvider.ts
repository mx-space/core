export interface Provider<T = unknown> {
  provide: new (...args: any[]) => T
  useValue: Partial<T>
}

export const defineProvider = <T>(provider: Provider<T>) => {
  return provider
}

export const defineProviders = (providers: Provider[]) => {
  return providers
}
