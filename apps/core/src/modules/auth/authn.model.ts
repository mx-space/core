import { mongooseLeanGetters } from 'mongoose-lean-getters'

import { CredentialDeviceType } from '@simplewebauthn/server/script/deps'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

const uint8ArrayGetterSetter = {
  get(uint8string: string) {
    const buffer = Buffer.from(uint8string, 'base64')
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    )
  },
  set(value: Uint8Array) {
    return Buffer.from(value).toString('base64')
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
