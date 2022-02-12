import 'zx/globals'
import { consola } from './consola.global'
import './dayjs.global'
import { isDev } from './env.global'

$.verbose = isDev

console.debug = (...rest) => {
  if (isDev) {
    consola.log.call(console, ...rest)
  }
}

Object.assign(globalThis, {
  isDev: isDev,
  consola,
})
