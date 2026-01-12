import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

/**
 * Simple URL validation helper for Mongoose schema validation
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const validateURL = {
  message: '请更正为正确的网址',
  validator: (v: string | Array<string>): boolean => {
    if (!v) {
      return true
    }
    if (Array.isArray(v)) {
      return v.every((url) => isValidUrl(url))
    }
    return isValidUrl(v)
  },
}

@modelOptions({
  options: {
    customName: 'Project',
  },
})
export class ProjectModel extends BaseModel {
  @prop({ required: true, unique: true })
  name: string

  @prop({
    validate: validateURL,
  })
  previewUrl?: string

  @prop({
    validate: validateURL,
  })
  docUrl?: string

  @prop({
    validate: validateURL,
  })
  projectUrl?: string

  @prop({
    type: String,
    validate: validateURL,
  })
  images?: string[]

  @prop({ required: true })
  description: string

  @prop({
    validate: validateURL,
  })
  avatar?: string

  @prop()
  text: string
}
