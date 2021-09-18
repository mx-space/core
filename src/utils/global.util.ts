import './dayjs.util'
import { isDev } from './index.util'

Object.assign(globalThis, {
  isDev: isDev,
})

console.debug = (...rest) => {
  if (isDev) {
    console.log.call(console, ...rest)
  }
}
