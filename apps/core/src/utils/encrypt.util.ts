import { ENCRYPT, SECRET_STORAGE_V2 } from '~/app.config'

import { SecretCodec } from './secret-codec'

export { mapString } from './secret-codec'

/** v17 facade keeps runtime configuration and the plaintext escape hatch. */
export class EncryptUtil {
  private static codec() {
    return new SecretCodec({ ...ENCRYPT, v2: SECRET_STORAGE_V2 })
  }
  static assertConfigured() {
    return this.codec().assertConfigured()
  }
  static isEncryptedString(value: string) {
    return this.codec().isEncryptedString(value)
  }
  static encrypt<T>(data: T, context = ''): T {
    return this.codec().encrypt(data, context)
  }
  static decrypt<T>(data: T, context = ''): T {
    return this.codec().decrypt(data, context)
  }
}
