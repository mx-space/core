import { SetMetadata } from '@nestjs/common'
import { CRON_DESCRIPTION } from '~/constants/meta.constant'

export const CronDescription = (description: string) =>
  SetMetadata(CRON_DESCRIPTION, description)
