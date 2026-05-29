/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { format as f } from 'date-fns'

import { translate } from '~/i18n/translate'

export enum DateFormat {
  'yyyy 年 M 月 d 日',
  'yyyy 年 M 月 d 日 HH:mm:ss',
  'HH:mm',

  'H:mm:ss a',
  'M-d HH:mm:ss',
}

export const parseDate = (
  time: string | Date,
  format: keyof typeof DateFormat = 'yyyy 年 M 月 d 日',
) => {
  const date = new Date(time)
  if (isNaN(date as any)) return 'N/A'
  return f(date, format)
}

export const relativeTimeFromNow = (
  time: Date | string,
  current = new Date(),
) => {
  if (!time) {
    return '-'
  }
  time = new Date(time)
  const msPerMinute = 60 * 1000
  const msPerHour = msPerMinute * 60
  const msPerDay = msPerHour * 24
  const msPerMonth = msPerDay * 30
  const msPerYear = msPerDay * 365

  const elapsed = +current - +time

  if (elapsed < msPerMinute) {
    const gap = Math.ceil(elapsed / 1000)
    return gap <= 0
      ? translate('time.justNow')
      : translate('time.secondsAgo', { count: gap })
  } else if (elapsed < msPerHour) {
    return translate('time.minutesAgo', {
      count: Math.round(elapsed / msPerMinute),
    })
  } else if (elapsed < msPerDay) {
    return translate('time.hoursAgo', {
      count: Math.round(elapsed / msPerHour),
    })
  } else if (elapsed < msPerMonth) {
    return translate('time.daysAgo', {
      count: Math.round(elapsed / msPerDay),
    })
  } else if (elapsed < msPerYear) {
    return translate('time.monthsAgo', {
      count: Math.round(elapsed / msPerMonth),
    })
  } else {
    return translate('time.yearsAgo', {
      count: Math.round(elapsed / msPerYear),
    })
  }
}

export const getDayOfYear = (date = new Date()) => {
  const now = date
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  const day = Math.floor(diff / oneDay)

  return day
}
