import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import axios from 'axios'
import FormData from 'form-data'

const sha1 = (str: string) =>
  crypto.createHash('sha1').update(str).digest('hex').toLowerCase()
const hmac = (str: string, key: string) =>
  crypto.createHmac('sha1', key).update(str).digest('hex').toLowerCase()

export const uploadFileToCOS = async (
  localFilePathOrBuffer: string | Buffer,
  remoteFileKey: string,
  options: {
    bucket: string
    region: string
    secretId: string
    secretKey: string
  },
) => {
  const { secretId, secretKey, bucket, region } = options
  const endpoint = `https://${bucket}.cos.${region}.myqcloud.com`

  const now = Date.now()
  const startTime = now / 1000,
    expireTime = now / 1000 + 900
  const keytime = `${startTime};${expireTime}`
  const tickets = [
    {
      'q-ak': secretId,
    },
    {
      'q-sign-algorithm': 'sha1',
    },
    {
      'q-sign-time': keytime,
    },
  ]
  const policy = JSON.stringify({
    expiration: new Date(expireTime * 1000).toISOString(),
    conditions: tickets,
  })
  const signature = hmac(sha1(policy), hmac(keytime, secretKey))
  const formData = new FormData({
    maxDataSize: 10e10,
  })
  Object.entries({
    key: remoteFileKey,
    policy: Buffer.from(policy).toString('base64'),
    'q-key-time': keytime,
    'q-signature': signature,

    ...tickets.reduce((acc, cur) => ({ ...acc, ...cur }), {}),
  }).forEach(([key, value]) => {
    formData.append(key, value)
  })

  formData.append(
    'file',
    typeof localFilePathOrBuffer == 'string'
      ? await fs.readFile(localFilePathOrBuffer)
      : Buffer.isBuffer(localFilePathOrBuffer)
        ? localFilePathOrBuffer
        : Buffer.from(localFilePathOrBuffer),
    {
      filename: remoteFileKey,
    },
  )

  await axios
    .post(endpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        // NOTE: important do this, if post file is over than 300K
        'Content-Length': formData.getLengthSync(),
      },
    })
    .catch((error) => {
      if (isDev) {
        console.dir(error)
      }
      console.log(error.response.data)
      throw error
    })
}
