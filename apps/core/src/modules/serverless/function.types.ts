import type { FastifyRequest } from 'fastify'

export interface FunctionContextRequest extends FastifyRequest {}

export interface FunctionContextResponse {
  throws: (code: number, message: any) => void
  type: (type: string) => FunctionContextResponse
  status: (code: number, statusMessage?: string) => FunctionContextResponse
  send: (data: any) => any
}

export interface BuiltInFunctionObject {
  name: string
  path: string
  method: string
  code: string
  reference: string
}

export const defineBuiltInSnippetConfig = (config: BuiltInFunctionObject) =>
  config
