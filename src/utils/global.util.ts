import { isDev } from './index.util'

Object.assign(globalThis, {
  isDev: isDev,
})
