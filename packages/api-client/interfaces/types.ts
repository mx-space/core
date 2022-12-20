export type Class<T> = new (...args: any[]) => T

export type SelectFields<T extends string> = `${'+' | '-' | ''}${T}`[]
