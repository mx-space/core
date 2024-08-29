import type { AuthConfig } from '@mx-space/complied/auth'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { Auth, setEnvDefaults } from '@mx-space/complied/auth'

import { getRequest } from './req.transformer'

export type ServerAuthConfig = Omit<AuthConfig, 'basePath'> & {
  basePath: string
}

export function CreateAuth(config: ServerAuthConfig) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      setEnvDefaults(process.env, config)

      const auth = await Auth(await toWebRequest(req), config)

      await toServerResponse(req, auth, res)
    } catch (error) {
      console.error(error)
      // throw error
      res.end(error.message)
    }
  }
}

async function toWebRequest(req: IncomingMessage) {
  const host = req.headers.host || 'localhost'
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  const base = `${protocol}://${host}`

  return getRequest(base, req)
}

async function toServerResponse(
  req: IncomingMessage,
  response: Response,
  res: ServerResponse,
) {
  response.headers.forEach((value, key) => {
    if (!value) {
      return
    }
    if (res.hasHeader(key)) {
      res.appendHeader(key, value)
    } else {
      res.setHeader(key, value)
    }
  })

  res.setHeader('Content-Type', response.headers.get('content-type') || '')
  res.setHeader('access-control-allow-methods', 'GET, POST')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader(
    'Access-Control-Allow-Origin',
    req.headers.origin || req.headers.referer || req.headers.host || '*',
  )
  res.setHeader('access-control-allow-credentials', 'true')

  const text = await response.text()
  res.writeHead(response.status, response.statusText)
  res.end(text)
}
