import { isDev } from '.'
import { consola } from './consola.util'
import './dayjs.util'

console.debug = (...rest) => {
  if (isDev) {
    consola.log.call(console, ...rest)
  }
}

Object.assign(globalThis, {
  isDev: isDev,
  consola,
})
