import cluster from 'cluster'
import { machineIdSync } from 'node-machine-id'

import { CLUSTER, SECURITY } from '~/app.config'

export const isDev = process.env.NODE_ENV == 'development'

export const isTest = !!process.env.TEST
export const cwd = process.cwd()

const getMachineId = () => {
  const id = machineIdSync()

  if (isDev && cluster.isPrimary) {
    console.log(id)
  }
  return id
}
export const __secret: any =
  SECURITY.jwtSecret ||
  Buffer.from(getMachineId()).toString('base64').slice(0, 15) ||
  'asjhczxiucipoiopiqm2376'

if (isDev && cluster.isPrimary) {
  console.log(__secret)
}
if (!CLUSTER.enable || cluster.isPrimary) {
  console.log(
    'JWT Secret start with :',
    __secret.slice(0, 5) + '*'.repeat(__secret.length - 5),
  )
}
