/* eslint-disable @typescript-eslint/no-empty-interface */
import type { FastifyRequest } from 'fastify'
export interface FunctionContextRequest extends FastifyRequest {}

export interface FunctionContextResponse {
  throws(code: number, message: any): void
  type(type: string): FunctionContextResponse
  status(code: number, statusMessage?: string): FunctionContextResponse
  send(data: any): void
}
