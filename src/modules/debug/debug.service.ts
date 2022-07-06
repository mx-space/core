import cluster from 'cluster'

import { Injectable } from '@nestjs/common'

import { CronOnce } from '~/common/decorator/cron-once.decorator'

@Injectable()
export class DebugService {
  constructor() {}

  @CronOnce('* * * * *')
  async reset() {
    console.log(process.pid, cluster.worker?.id)
  }
}
