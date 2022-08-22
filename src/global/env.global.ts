import cluster from 'cluster'

export const isMainCluster =
  process.env.NODE_APP_INSTANCE && parseInt(process.env.NODE_APP_INSTANCE) === 0
export const isMainProcess = cluster.isPrimary || isMainCluster

export const isDev = process.env.NODE_ENV == 'development'

export const isTest = !!process.env.TEST
export const cwd = process.cwd()
