import { RouteConfig } from '@nestjs/platform-fastify'
import type { RouteShorthandOptions } from 'fastify'

export const FASTIFY_ROUTE_OPTIONS_CONFIG = Symbol(
  'mx-space.fastify-route-options',
)

export type FastifyRouteOptions = Pick<
  RouteShorthandOptions,
  'bodyLimit' | 'errorHandler'
>

export const WithFastifyRouteOptions = (options: FastifyRouteOptions) =>
  RouteConfig({ [FASTIFY_ROUTE_OPTIONS_CONFIG]: options })
