import { EncryptUtil } from '~/utils/encrypt.util'

describe('encrypt.util', () => {
  test('encrypt', () => {
    const data = '````````'
    const encrypt = EncryptUtil.encrypt(data)
    expect(encrypt).toMatchInlineSnapshot('"$${mx}$$gzQ0SeKxxufRtkzgtnCloQ=="')
  })

  test('decrypt', () => {
    const data = '$${mx}$$gzQ0SeKxxufRtkzgtnCloQ=='
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
})
