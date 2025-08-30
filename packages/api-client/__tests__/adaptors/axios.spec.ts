import { axiosAdaptor } from '~/adaptors/axios'
import { testAdaptor } from '../helpers/adaptor-test'

describe('test axios adaptor', () => {
  testAdaptor(axiosAdaptor)
})
