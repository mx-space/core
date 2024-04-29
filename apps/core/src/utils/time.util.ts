import dayjs from 'dayjs'

/** Get Time, format `12:00:00`  */
export const getShortTime = (date: Date) => {
  return Intl.DateTimeFormat('en-US', {
    timeStyle: 'medium',
    hour12: false,
  }).format(date)
}

export const getShortDate = (date: Date) => {
  return Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
  })
    .format(date)
    .replaceAll('/', '-')
}
/** 2-12-22, 21:31:42 */
export const getShortDateTime = (date: Date) => {
  return Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  })
    .format(date)
    .replaceAll('/', '-')
}
/** YYYY-MM-DD_HH:mm:ss  */
export const getMediumDateTime = (date: Date) => {
  return dayjs(date).format('YYYY-MM-DD_HH:mm:ss')
}
export const getTodayEarly = (today: Date) =>
  dayjs(today).set('hour', 0).set('minute', 0).set('millisecond', 0).toDate()

export const getWeekStart = (today: Date) =>
  dayjs(today)
    .set('day', 0)
    .set('hour', 0)
    .set('millisecond', 0)
    .set('minute', 0)
    .toDate()

export function getLessThanNow(date: Date | undefined) {
  const now = new Date()

  if (!date) {
    return now
  }
  const created = date ? (dayjs(date).diff(now) > 0 ? now : date) : now
  return created
}
