import { mongooseLeanGetters } from 'mongoose-lean-getters'

import { CredentialDeviceType } from '@simplewebauthn/server/script/deps'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

const uint8ArrayGetterSetter = {
  get(uint8string: string) {
    const base64String = uint8string.replace(/-/g, '+').replace(/_/g, '/') // 将 URL 安全字符转换回标准 Base64 字符
    const buffer = Buffer.from(base64String, 'base64')
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    )
  },
  set(value: Uint8Array) {
    return Buffer.from(value)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  },

  type: String,
}

@modelOptions({
  options: {
    customName: 'authn',
  },
})
@plugin(mongooseLeanGetters)
export class AuthnModel {
  @prop()
  name: string

  @prop({
    ...uint8ArrayGetterSetter,
  })
  credentialID: Uint8Array
  @prop({
    ...uint8ArrayGetterSetter,
  })
  credentialPublicKey: Uint8Array
  @prop()
  counter: number
  @prop({
    type: String,
  })
  credentialDeviceType: CredentialDeviceType
  @prop()
  credentialBackedUp: boolean
}
