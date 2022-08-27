import axios from 'axios'
import crypto from 'crypto'
import FormData from 'form-data'
import fs from 'fs-extra'

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
    onProgress?: (progressFloat: number) => void
  },
) => {
  const {
    secretId,
    secretKey,
    bucket,
    region,
    onProgress = () => void 0,
  } = options
  const endpoint = `https://${bucket}.cos.${region}.myqcloud.com`

  const now = +new Date()
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
      onDownloadProgress: (progress) => {
        if (onProgress) {
          onProgress(progress.loaded / progress.total)
        }
      },
    })
    .catch((err) => {
      if (isDev) {
        console.dir(err)
      }
      console.log(err.response.data)
      throw err
    })
}
