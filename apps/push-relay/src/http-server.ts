import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'

import { ZodError } from 'zod'

import type { PushRelayService } from './relay-service.js'
import { RelayHttpError } from './relay-service.js'

const MAX_BODY_BYTES = 64 * 1024

const sendJSON = (response: ServerResponse, status: number, data: unknown) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(data))
}

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) {
      throw new RelayHttpError(
        413,
        'body_too_large',
        'Request body exceeds 64 KiB',
      )
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

const parseJSON = (body: Buffer) => {
  try {
    return JSON.parse(body.toString('utf8')) as unknown
  } catch {
    throw new RelayHttpError(400, 'invalid_json', 'Request body must be JSON')
  }
}

const header = (request: IncomingMessage, name: string) => {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

export const createPushRelayServer = (service: PushRelayService) =>
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://relay.local')
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJSON(response, 200, { ok: true })
        return
      }

      if (request.method === 'POST' && url.pathname === '/v1/installations') {
        const result = await service.registerInstallation(
          parseJSON(await readBody(request)),
        )
        sendJSON(response, 201, result)
        return
      }

      const installationMatch = /^\/v1\/installations\/([^/]+)\/token$/.exec(
        url.pathname,
      )
      if (request.method === 'PUT' && installationMatch) {
        const result = await service.updateInstallationToken(
          decodeURIComponent(installationMatch[1]!),
          header(request, 'authorization'),
          parseJSON(await readBody(request)),
        )
        sendJSON(response, 200, result)
        return
      }

      if (
        request.method === 'POST' &&
        url.pathname === '/v1/source-activations'
      ) {
        const result = await service.createActivationTicket(
          header(request, 'authorization'),
        )
        sendJSON(response, 201, result)
        return
      }

      if (
        request.method === 'POST' &&
        url.pathname === '/v1/source-activations/claim'
      ) {
        const result = await service.claimSourceActivation(
          header(request, 'authorization'),
          parseJSON(await readBody(request)),
        )
        sendJSON(response, 201, result)
        return
      }

      const bindingMatch = /^\/v1\/bindings\/([^/]+)$/.exec(url.pathname)
      if (request.method === 'GET' && bindingMatch) {
        const result = await service.getBinding(
          header(request, 'authorization'),
          decodeURIComponent(bindingMatch[1]!),
        )
        sendJSON(response, 200, result)
        return
      }
      if (request.method === 'DELETE' && bindingMatch) {
        const result = await service.revokeBinding(
          header(request, 'authorization'),
          decodeURIComponent(bindingMatch[1]!),
        )
        sendJSON(response, 200, result)
        return
      }

      const preferencesMatch = /^\/v1\/bindings\/([^/]+)\/preferences$/.exec(
        url.pathname,
      )
      if (request.method === 'PUT' && preferencesMatch) {
        const result = await service.updateBindingPreferences(
          header(request, 'authorization'),
          decodeURIComponent(preferencesMatch[1]!),
          parseJSON(await readBody(request)),
        )
        sendJSON(response, 200, result)
        return
      }

      if (
        request.method === 'POST' &&
        url.pathname === '/v1/webhooks/mx-core'
      ) {
        const result = await service.acceptEvent({
          rawBody: await readBody(request),
          sourceId: header(request, 'x-push-source'),
          deliveryId: header(request, 'x-push-delivery'),
          timestamp: header(request, 'x-push-timestamp'),
          signature: header(request, 'x-push-signature'),
        })
        sendJSON(response, 202, result)
        return
      }

      sendJSON(response, 404, {
        error: 'not_found',
        message: 'Route not found',
      })
    } catch (error) {
      if (error instanceof RelayHttpError) {
        sendJSON(response, error.status, {
          error: error.code,
          message: error.message,
        })
      } else if (error instanceof ZodError) {
        sendJSON(response, 422, {
          error: 'validation_failed',
          message: 'Request validation failed',
          issues: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
      } else {
        console.error(error)
        sendJSON(response, 500, {
          error: 'internal_error',
          message: 'Internal server error',
        })
      }
    }
  })
