import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  type KeyObject,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto'

const magic = Buffer.from('MXBACKUP')
const nonceLength = 12
const tagLength = 16
const oaepLabel = Buffer.from('mx-backup:v2')

export function backupEncryptionPublicKey(value: string | undefined) {
  try {
    if (!value || !value.startsWith('-----BEGIN PUBLIC KEY-----'))
      throw new Error('Invalid backup key or envelope')
    const key = createPublicKey(value)
    const bits = key.asymmetricKeyDetails?.modulusLength ?? 0
    if (key.asymmetricKeyType !== 'rsa' || bits < 2048 || bits > 4096)
      throw new Error('Invalid backup key or envelope')
    return key
  } catch {
    throw new Error('A valid RSA backup encryption public key is required')
  }
}

export function encryptBackup(archive: Buffer, publicKey: KeyObject) {
  const key = randomBytes(32)
  const wrappedKey = publicEncrypt(
    { key: publicKey, oaepHash: 'sha256', oaepLabel },
    key,
  )
  const length = Buffer.alloc(2)
  length.writeUInt16BE(wrappedKey.length)
  const header = Buffer.concat([magic, Buffer.from([2]), length, wrappedKey])
  const nonce = randomBytes(nonceLength)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(header)
  const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()])
  return Buffer.concat([header, nonce, cipher.getAuthTag(), ciphertext])
}

export function decryptBackup(archive: Buffer, key: string | undefined) {
  if (archive.subarray(0, 4).equals(Buffer.from('PK\x03\x04'))) return archive
  if (!archive.subarray(0, magic.length).equals(magic) || archive.length < 11) {
    throw new Error('Invalid or unsupported backup file')
  }
  if (!key?.trim()) throw new Error('Backup decryption key is required')
  try {
    let headerLength = magic.length + 1
    let dataKey: Buffer
    if (archive[magic.length] === 1) {
      // Read archives created by the earlier symmetric-key implementation.
      if (!/^[\da-f]{64}$/i.test(key.trim()))
        throw new Error('Invalid backup key or envelope')
      dataKey = Buffer.from(key.trim(), 'hex')
    } else if (archive[magic.length] === 2) {
      const wrappedLength = archive.readUInt16BE(headerLength)
      if (wrappedLength < 256 || wrappedLength > 512)
        throw new Error('Invalid backup key or envelope')
      headerLength += 2 + wrappedLength
      if (archive.length <= headerLength + nonceLength + tagLength)
        throw new Error('Invalid backup key or envelope')
      dataKey = privateDecrypt(
        { key: key.trim(), oaepHash: 'sha256', oaepLabel },
        archive.subarray(magic.length + 3, headerLength),
      )
    } else {
      throw new Error('Invalid backup key or envelope')
    }
    const payloadOffset = headerLength + nonceLength + tagLength
    if (archive.length <= payloadOffset)
      throw new Error('Invalid backup key or envelope')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      dataKey,
      archive.subarray(headerLength, headerLength + nonceLength),
    )
    decipher.setAAD(archive.subarray(0, headerLength))
    decipher.setAuthTag(
      archive.subarray(headerLength + nonceLength, payloadOffset),
    )
    return Buffer.concat([
      decipher.update(archive.subarray(payloadOffset)),
      decipher.final(),
    ])
  } catch {
    throw new Error('Cannot decrypt backup: wrong key or damaged file')
  }
}
