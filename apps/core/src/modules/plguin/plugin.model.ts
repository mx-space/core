import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({
  options: {
    customName: 'plugin',
  },
})
export class PluginModel {
  @prop({
    default: false,
  })
  enabled: boolean

  @prop({
    required: true,
  })
  name: string

  @prop({
    required: true,
  })
  path: string
}
