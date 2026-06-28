// Ambient type declarations for serverless functions, served raw to Monaco
// Editor for code completion (imported via Vite `?raw`, excluded from tsc so
// these globals do not leak into the project).
// These must stay in sync with sandboxGlobals in sandbox-worker.runtime.js —
// update this file whenever the sandbox API surface changes.
// ===== Serverless Function Type Declaration =====
// Generated from sandbox runtime API surface
// See: src/utils/sandbox/sandbox-worker.runtime.js

declare interface FunctionContextRequest {
  query: Record<string, string>
  headers: Record<string, string>
  params: Record<string, string>
  method: string
  body?: any
  url?: string
  ip?: string
  [k: string]: any
}

declare interface ICache {
  get<T = any>(key: string): Promise<T>
  set(key: string, value: string | object, ttl?: number): Promise<void>
  del(key: string): Promise<void>
}

declare interface IDb {
  get<T = any>(key: string): Promise<T>
  find<T = any>(condition: Record<string, any>): Promise<T[]>
  set(key: string, value: any): Promise<unknown>
  insert(key: string, value: any): Promise<unknown>
  update(key: string, value: any): Promise<unknown>
  del(key: string): Promise<unknown>
}

declare interface IStorage {
  cache: ICache
  db: IDb
}

declare interface ConfigService {
  get(key: string): Promise<any>
}

declare enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
}

declare interface OwnerModel {
  id: string
  username: string
  name: string
  introduce?: string
  avatar?: string
  mail?: string
  url?: string
  lastLoginTime?: Date
  lastLoginIp?: string
  socialIds?: any
}

declare interface Context {
  req: FunctionContextRequest
  res: Record<string, never>

  query: Record<string, string>
  headers: Record<string, string>
  params: Record<string, string>
  method: string

  hasAdminAccess: boolean
  isAuthenticated: boolean
  secret: Record<string, any>

  model: { id: string; name: string; reference: string }
  document: { id: string; name: string; reference: string }
  name: string
  reference: string

  storage: IStorage

  getOwner(): Promise<OwnerModel>
  getService(name: 'config'): Promise<ConfigService>

  broadcast(event: string, data: any): void
  writeAsset(path: string, data: any, options?: any): Promise<void>
  readAsset(path: string, options?: any): Promise<any>

  throws(status: number, message: any): never
}

declare const context: Context
declare const logger: Console
declare const __dirname: string
declare const __filename: string

declare const process: {
  nextTick(callback: (...args: any[]) => void): void
}

declare function require(id: string): Promise<any>

declare function handler(
  context: Context,
  require: (id: string) => Promise<any>,
): any
