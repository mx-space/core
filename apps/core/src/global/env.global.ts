import cluster from 'node:cluster'

import { parseBooleanishValue } from '~/utils/tool.util'

export const isMainCluster =
  process.env.NODE_APP_INSTANCE &&
  Number.parseInt(process.env.NODE_APP_INSTANCE) === 0
export const isMainProcess = cluster.isPrimary || isMainCluster

export const isDev = process.env.NODE_ENV == 'development'

export const isTest = !!process.env.TEST
export const isDebugMode = parseBooleanishValue(process.env.DEBUG_MODE) || false
export const cwd = process.cwd()
