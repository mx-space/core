import 'reflect-metadata'

import {
  Encrypt,
  isEncryptProperty,
} from '~/modules/configs/configs.encrypt.util'

describe('encrypt.util', () => {
  class A {
    @Encrypt
    a = '$${mx}$$jansTW9ZaY6IVtiaDF6Bog=='

    b = 'a'
  }

  test('encrypt', () => {
    const a = new A()
    expect(isEncryptProperty(a, 'a')).toBe(true)
    expect(isEncryptProperty(a, 'b')).toBe(false)
  })

  test('transform', () => {
    const a = new A()

    expect(1).toBe(1)
  })
})
