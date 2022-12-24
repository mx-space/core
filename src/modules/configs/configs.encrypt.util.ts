import { Transform } from 'class-transformer'

import { EncryptUtil } from '~/utils/encrypt.util'

const metaKey = 'configs:encrypt'
export const Encrypt: PropertyDecorator = (target: any, key: string) => {
  Reflect.defineMetadata(metaKey, true, target, key)
  Transform(({ value }) => EncryptUtil.decrypt(value))(target, key)
}

export const isEncryptProperty = (target: any, key: string) => {
  return !!Reflect.getMetadata(metaKey, target, key)
}
