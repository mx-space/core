import FormData from 'form-data'

import { fetchAdaptor } from '~/adaptors/fetch'

import { testAdaptor } from '../helpers/adaptor-test'

describe('test fetch adaptor', () => {
  beforeAll(() => {
    global.FormData = FormData as any
  })
  testAdaptor(fetchAdaptor)
})
