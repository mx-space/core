import { consola } from './consola.util'
import './dayjs.util'
import { isDev } from './index.util'

console.debug = (...rest) => {
  if (isDev) {
    consola.log.call(console, ...rest)
  }
}

Object.assign(globalThis, {
  isDev: isDev,
  consola,
})
