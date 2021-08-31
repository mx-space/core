export * from './ip.util'
export const isDev = process.env.NODE_ENV == 'development'

export const md5 = (text: string) =>
  require('crypto').createHash('md5').update(text).digest('hex')
export function getAvatar(mail: string) {
  if (!mail) {
    return ''
  }
  return `https://sdn.geekzu.org/avatar/${md5(mail)}`
}
