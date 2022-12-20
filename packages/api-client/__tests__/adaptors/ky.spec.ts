import '../helpers/global-fetch'

import { defaultKyAdaptor } from '~/adaptors/ky'

import { testAdaptor } from '../helpers/adaptor-test'

describe('test ky adaptor', () => {
  testAdaptor(defaultKyAdaptor)
})
