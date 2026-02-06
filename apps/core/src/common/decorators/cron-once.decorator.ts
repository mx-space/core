import cluster from 'node:cluster'
import { Cron } from '@nestjs/schedule'
import { isMainProcess } from '~/global/env.global'

export const CronOnce: typeof Cron = (...rest): MethodDecorator => {
  if (isMainProcess || (cluster.isWorker && cluster.worker?.id === 1)) {
    // eslint-disable-next-line no-useless-call
    return Cron.call(null, ...rest)
  }

  return () => {}
}
