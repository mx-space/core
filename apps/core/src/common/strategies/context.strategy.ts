import type {
  ContextId,
  ContextIdStrategy,
  HostComponentInfo,
} from '@nestjs/core'
import type { FastifyRequest } from 'fastify'

import { ContextIdFactory } from '@nestjs/core'

const tenants = new Map<string, ContextId>()

export class AggregateByTenantContextIdStrategy implements ContextIdStrategy {
  attach(contextId: ContextId, request: FastifyRequest) {
    const tenantId = request.headers['x-tenant-id'] as string
    let tenantSubTreeId: ContextId

    if (tenants.has(tenantId)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      tenantSubTreeId = tenants.get(tenantId)!
    } else {
      tenantSubTreeId = ContextIdFactory.create()
      tenants.set(tenantId, tenantSubTreeId)
    }

    // If tree is not durable, return the original "contextId" object
    return (info: HostComponentInfo) =>
      info.isTreeDurable ? tenantSubTreeId : contextId
  }
}
