import FormData from 'form-data'
import fetch from 'node-fetch'

import { fetchAdaptor } from '~/adaptors/fetch'

import { testAdaptor } from '../helpers/adaptor-test'

describe('test fetch adaptor', () => {
  beforeAll(() => {
    global.fetch = fetch as any
    global.FormData = FormData as any
  })
  testAdaptor(fetchAdaptor)
})
