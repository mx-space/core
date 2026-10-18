import { createCipheriv, randomBytes } from 'node:crypto'

import JSZip from 'jszip'

import {
  backupEncryptionPublicKey,
  decryptBackup,
  encryptBackup,
} from '~/modules/backup/backup-crypto'

import { generateBackupKeyPair } from '../../../../../admin/src/features/backup/utils/backup-key'

let key: string
let publicKey: ReturnType<typeof backupEncryptionPublicKey>
beforeAll(async () => {
  const pair = await generateBackupKeyPair()
  key = pair.privateKey
  publicKey = backupEncryptionPublicKey(pair.publicKey)
})

it('preserves credentials inside an encrypted archive without exposing them', async () => {
  const zip = new JSZip()
  zip.file(
    'config.json',
    JSON.stringify({ secretKey: 'retained-s3-credential' }),
  )
  const archive = await zip.generateAsync({ type: 'nodebuffer' })
  const encrypted = encryptBackup(archive, publicKey)
  expect(encrypted.includes(Buffer.from('retained-s3-credential'))).toBe(false)
  expect(encrypted.subarray(0, 2).toString()).not.toBe('PK')
  expect(encryptBackup(archive, publicKey)).not.toEqual(encrypted)
  const restored = await JSZip.loadAsync(decryptBackup(encrypted, key))
  expect(
    JSON.parse(await restored.file('config.json')!.async('string')),
  ).toEqual({
    secretKey: 'retained-s3-credential',
  })
})

it('rejects wrong keys, corruption of every envelope component and truncated files', () => {
  const encrypted = encryptBackup(Buffer.from('backup'), publicKey)
  expect(() =>
    decryptBackup(encrypted, randomBytes(32).toString('hex')),
  ).toThrow()
  expect(() => decryptBackup(encrypted, undefined)).toThrow(
    'Backup decryption key is required',
  )
  for (let offset = 0; offset < encrypted.length; offset++) {
    const damaged = Buffer.from(encrypted)
    damaged[offset] ^= 1
    expect(() => decryptBackup(damaged, key)).toThrow()
    expect(() => decryptBackup(encrypted.subarray(0, offset), key)).toThrow()
  }
})

it('can read historical ZIP backups without a key', async () => {
  const archive = await new JSZip()
    .file('legacy.txt', 'old backup')
    .generateAsync({
      type: 'nodebuffer',
    })
  expect(decryptBackup(archive, undefined)).toEqual(archive)
  expect(() => decryptBackup(Buffer.from('not a backup'), key)).toThrow()
})

it.each([undefined, '', 'password', 'x'.repeat(64), 'a'.repeat(63)])(
  'rejects an absent or invalid backup encryption key: %s',
  (value) => {
    expect(() => backupEncryptionPublicKey(value)).toThrow('public key')
  },
)

it('cannot decrypt with a public key or accept private material in settings', () => {
  const encrypted = encryptBackup(Buffer.from('backup'), publicKey)
  expect(() =>
    decryptBackup(
      encrypted,
      publicKey.export({ type: 'spki', format: 'pem' }) as string,
    ),
  ).toThrow()
  expect(() => backupEncryptionPublicKey(key)).toThrow()
})

it('reads the earlier symmetric format using a supplied recovery key', () => {
  const oldKey = randomBytes(32)
  const nonce = randomBytes(12)
  const header = Buffer.from('MXBACKUP\x01')
  const cipher = createCipheriv('aes-256-gcm', oldKey, nonce)
  cipher.setAAD(header)
  const ciphertext = Buffer.concat([
    cipher.update('legacy backup'),
    cipher.final(),
  ])
  const archive = Buffer.concat([
    header,
    nonce,
    cipher.getAuthTag(),
    ciphertext,
  ])
  expect(decryptBackup(archive, oldKey.toString('hex')).toString()).toBe(
    'legacy backup',
  )
})
