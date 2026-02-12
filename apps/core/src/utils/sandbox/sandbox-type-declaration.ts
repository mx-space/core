/**
 * Serverless 函数的类型声明，供 Monaco Editor 代码补全使用
 * 此声明与 sandbox-worker-code.ts 中 sandboxGlobals 保持一致
 *
 * 变更 sandbox API 时须同步更新此文件
 */
export function getSandboxTypeDeclaration(): string {
  return `
// ===== Serverless Function Type Declaration =====
// Generated from sandbox runtime API surface
// See: src/utils/sandbox/sandbox-worker-code.ts

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

declare interface HttpAxios {
  get(url: string, config?: any): Promise<{ data: any; status: number; headers: Record<string, string> }>
  post(url: string, data?: any, config?: any): Promise<{ data: any; status: number; headers: Record<string, string> }>
  put(url: string, data?: any, config?: any): Promise<{ data: any; status: number; headers: Record<string, string> }>
  delete(url: string, config?: any): Promise<{ data: any; status: number; headers: Record<string, string> }>
  patch(url: string, data?: any, config?: any): Promise<{ data: any; status: number; headers: Record<string, string> }>
  request(config: any): Promise<{ data: any; status: number; headers: Record<string, string> }>
}

declare interface HttpService {
  axios: HttpAxios
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
  _id: string
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

  isAuthenticated: boolean
  secret: Record<string, any>

  model: { id: string; name: string; reference: string }
  document: { id: string; name: string; reference: string }
  name: string
  reference: string

  storage: IStorage

  getOwner(): Promise<OwnerModel>
  getService(name: 'http'): Promise<HttpService>
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

declare function handler(context: Context, require: (id: string) => Promise<any>): any
`
}
