import { modelOptions, plugin, prop } from '@typegoose/typegoose'
import { mongooseLeanGetters } from 'mongoose-lean-getters'

type CredentialDeviceType = 'singleDevice' | 'multiDevice'

const uint8ArrayGetterSetter = {
  get(uint8string: string) {
    const base64String = uint8string.replaceAll('-', '+').replaceAll('_', '/') // 将 URL 安全字符转换回标准 Base64 字符
    const buffer = Buffer.from(base64String, 'base64')
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    )
  },
  set(value: Uint8Array) {
    return Buffer.from(value)
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
  },

  type: String,
}

@modelOptions({
  options: {
    customName: 'authn',
  },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
    },
  },
})
@plugin(mongooseLeanGetters)
export class AuthnModel {
  @prop({ unique: true })
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
