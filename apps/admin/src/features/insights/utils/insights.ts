export function formatNumber(value: number | string) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-US').format(value)
    : value
}
