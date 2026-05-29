import type { CronTaskStatus, CronTaskType } from '~/api/cron-tasks'

export interface CronListFilters {
  statusFilter?: CronTaskStatus
  typeFilter?: CronTaskType
}

export interface SelectOption {
  label: string
  value: string
}
