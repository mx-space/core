import { EncryptUtil, mapString } from '~/utils/encrypt.util'

describe('encrypt.util', () => {
  test('encrypt', () => {
    const data = '````````'
    const encrypt = EncryptUtil.encrypt(data)
    expect(encrypt).toMatchInlineSnapshot('"$${mx}$$jansTW9ZaY6IVtiaDF6Bog=="')
  })

  test('decrypt', () => {
    const data = '$${mx}$$jansTW9ZaY6IVtiaDF6Bog=='
    const encrypt = EncryptUtil.decrypt(data)
    expect(encrypt).toMatchInlineSnapshot('"````````"')
  })

  test('decrypt not encrypted data', () => {
    const data = 'gzQ0SeKxxufRtkzgtnCloQ=='
    const encrypt = EncryptUtil.decrypt(data)
    expect(encrypt).toBe(data)
  })

  test('encrypt encrypted data', () => {
    const data = '$${mx}$$gzQ0SeKxxufRtkzgtnCloQ=='
    const encrypt = EncryptUtil.encrypt(data)
    expect(encrypt).toBe(data)
  })

  test('mapString', () => {
    expect(mapString('1234567890')).toBe(
      '3b5aa8094f9d741d2a5cb7e8120f92aad4916df6beafe1be0008a2add070f523',
    )
    expect(() => mapString('1'.repeat(65))).toThrow()
    expect(mapString('1'.repeat(64))).toBe(
      '1111111111111111111111111111111111111111111111111111111111111111',
    )
    expect(() => mapString('')).toThrow()
    expect(mapString('1')).toBe(
      '60ea9346091539d407c864b51fec440823657a1dfef377091d4763f791d67980',
    )
  })
})
