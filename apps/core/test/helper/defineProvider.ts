export interface Provider<T = unknown> {
  provide: new (...args: any[]) => T
  useValue: Partial<T>
}

export const defineProvider = <T>(provider: Provider<T>) => {
  return provider
}

export function defineProviders<T>(providers: [Provider<T>]): [Provider<T>]
export function defineProviders<T1, T2>(
  providers: [Provider<T1>, Provider<T2>],
): [Provider<T1>, Provider<T2>]
export function defineProviders<T1, T2, T3>(
  providers: [Provider<T1>, Provider<T2>, Provider<T3>],
): [Provider<T1>, Provider<T2>, Provider<T3>]

export function defineProviders(providers: Provider[]) {
  return providers
}
