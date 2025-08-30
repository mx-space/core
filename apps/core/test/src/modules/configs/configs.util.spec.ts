import 'reflect-metadata'
import {
  decryptObject,
  Encrypt,
  encryptObject,
  encryptProperty,
  isEncryptProperty,
} from '~/modules/configs/configs.encrypt.util'

describe('encrypt.util', () => {
  class A {
    @Encrypt
    a = 'aaaaaaaaaaa'

    b = 'a'
  }

  test('encrypt', () => {
    const a = new A()
    expect(isEncryptProperty(a, 'a')).toBe(true)
    expect(isEncryptProperty(a, 'b')).toBe(false)
  })

  test('encrypt object', () => {
    const a = new A()

    expect(encryptObject(a)).toMatchInlineSnapshot(`
      A {
        "a": "$\${mx}$$gI7uMH5BfrX3A+U7HhvJPQ==",
        "b": "a",
      }
    `)
  })

  test('decrypt object', () => {
    const a = new A()

    a.a = encryptProperty(a, 'a', a.a)

    expect(decryptObject(a)).toMatchInlineSnapshot(`
      A {
        "a": "aaaaaaaaaaa",
        "b": "a",
      }
    `)
  })

  class Deep {
    @Encrypt
    a = 'aaaaaaaaaaa'

    b = 'a'

    c = new A()
  }

  test('encrypt object deep', () => {
    const a = new Deep()

    expect(encryptObject(a)).toMatchInlineSnapshot(`
    Deep {
      "a": "$\${mx}$$gI7uMH5BfrX3A+U7HhvJPQ==",
      "b": "a",
      "c": A {
        "a": "$\${mx}$$gI7uMH5BfrX3A+U7HhvJPQ==",
        "b": "a",
      },
    }
  `)
  })

  test('decrypt object deep', () => {
    const a = new Deep()
    encryptProperty(a, 'a', a.a)
    encryptProperty(a.c, 'a', a.c.a)
    expect(decryptObject(a)).toMatchInlineSnapshot(`
    Deep {
      "a": "aaaaaaaaaaa",
      "b": "a",
      "c": A {
        "a": "aaaaaaaaaaa",
        "b": "a",
      },
    }
  `)
  })
})
