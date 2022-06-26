import { resolve } from 'path'

import { LOG_DIR } from '~/constants/path.constant'

import { getShortDate } from './time.util'

export const getTodayLogFilePath = () =>
  resolve(LOG_DIR, `stdout_${getShortDate(new Date())}.log`)
