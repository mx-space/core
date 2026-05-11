import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

@Injectable()
export class EnrichmentOriginGuard implements CanActivate {
  constructor(private readonly configsService: ConfigsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getNestExecutionContextRequest(context)

    if (req.user) return true

    const reqOrigin = pickRequestOrigin(req)
    if (!reqOrigin) {
      throw new ForbiddenException('origin required')
    }

    const allowed = await this.allowedOrigins()
    if (!allowed.has(reqOrigin)) {
      throw new ForbiddenException('origin not allowed')
    }
    return true
  }

  private async allowedOrigins(): Promise<Set<string>> {
    const url = await this.configsService.get('url')
    const origins = new Set<string>()
    for (const candidate of [url?.webUrl, url?.adminUrl]) {
      if (typeof candidate !== 'string' || candidate.length === 0) continue
      const origin = toOriginOrNull(candidate)
      if (origin) origins.add(origin)
    }
    return origins
  }
}

function pickRequestOrigin(req: FastifyBizRequest): string | null {
  const originHeader = req.headers.origin
  if (typeof originHeader === 'string' && originHeader.length > 0) {
    return toOriginOrNull(originHeader)
  }
  const refererHeader = req.headers.referer
  if (typeof refererHeader === 'string' && refererHeader.length > 0) {
    return toOriginOrNull(refererHeader)
  }
  return null
}

function toOriginOrNull(raw: string): string | null {
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}
