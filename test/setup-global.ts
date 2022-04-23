import 'reflect-metadata'

import { register } from '~/global/index.global'

beforeAll(() => {
  register()

  // @ts-ignore
  global.isDev = true

  // @ts-ignore
  process.env.TEST = true
})
