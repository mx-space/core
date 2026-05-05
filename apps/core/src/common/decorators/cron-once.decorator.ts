import cluster from 'node:cluster'

import { Cron } from '@nestjs/schedule'

import { isMainProcess } from '~/global/env.global'

const noop: MethodDecorator = () => {}

export const CronOnce: typeof Cron = (...rest): MethodDecorator => {
  const isFirstWorker = cluster.isWorker && cluster.worker?.id === 1
  if (isMainProcess || isFirstWorker) {
    return Cron(...rest)
  }
  return noop
}
