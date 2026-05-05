import { Injectable, Logger } from '@nestjs/common'

import type { DataJob } from './data-jobs.types'

@Injectable()
export class DataJobsRunner {
  private readonly logger = new Logger(DataJobsRunner.name)
  private jobs: DataJob[] = []

  register(job: DataJob) {
    this.jobs.push(job)
  }

  async runAll(): Promise<void> {
    if (this.jobs.length === 0) {
      this.logger.log('No data jobs registered')
      return
    }

    for (const job of this.jobs) {
      this.logger.log(`Running data job: ${job.id} — ${job.description}`)
      try {
        const result = await job.run()
        this.logger.log(
          `Data job ${job.id} completed: ${JSON.stringify(result)}`,
        )
      } catch (error) {
        this.logger.error(`Data job ${job.id} failed: ${error.message}`)
        throw error
      }
    }
  }
}
