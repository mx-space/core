import { createCipheriv } from 'node:crypto'

/** Historical fixture writer. Production only writes authenticated V2. */
export function legacySecret(value: string, key: string) {
  const cipher = createCipheriv('aes-256-ecb', Buffer.from(key, 'hex'), '')
  return (
    '$${mx}$$' +
    Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString(
      'base64',
    )
  )
}
