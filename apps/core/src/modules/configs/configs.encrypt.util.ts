import { EncryptUtil } from '~/utils/encrypt.util'
import { isArrayLike, isObject } from 'lodash'
import { LRUCache } from 'lru-cache'

const metaKey = 'configs:encrypt'
export const Encrypt: PropertyDecorator = (target: any, key: string) => {
  Reflect.defineMetadata(metaKey, true, target, key)
}

export const isEncryptProperty = (target: any, key: string) => {
  return (
    typeof target[key] == 'string' &&
    !!Reflect.getMetadata(metaKey, target, key)
  )
}
const decryptLRU = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 5,
})
export const decryptProperty = (target: any, key: string, value: any) => {
  if (isEncryptProperty(target, key)) {
    if (decryptLRU.has(value)) {
      return decryptLRU.get(value)
    }
    const decryptValue = EncryptUtil.decrypt(value)
    decryptLRU.set(value, decryptValue)
    return decryptValue
  }
  return value
}

export const decryptObject = (target: any) => {
  const keys = Object.keys(target)
  for (const key of keys) {
    const value = target[key]

    if (isObject(value) && !isArrayLike(value)) {
      target[key] = decryptObject(value)
      continue
    }
    target[key] = decryptProperty(target, key, target[key])
  }
  return target
}

export const encryptProperty = (target: any, key: string, value: any) => {
  if (isEncryptProperty(target, key)) {
    return EncryptUtil.encrypt(value)
  }
  return value
}

export const encryptObject = (target: any) => {
  const keys = Object.keys(target)
  for (const key of keys) {
    const value = target[key]

    // 前置判断 整个 Object 都是被加密的

    if (
      isObject(value) &&
      !isArrayLike(value) &&
      !isEncryptProperty(target, key)
    ) {
      target[key] = encryptObject(value)
      continue
    }

    target[key] = encryptProperty(target, key, target[key])
  }
  return target
}
