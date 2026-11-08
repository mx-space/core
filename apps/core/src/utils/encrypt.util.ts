import { ENCRYPT } from '~/app.config'

import { SecretCodec } from './secret-codec'

/** Runtime facade: authenticated V2 writes, historical plaintext/ECB reads. */
export class EncryptUtil {
  private static codec() {
    return new SecretCodec(ENCRYPT)
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
