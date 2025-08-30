import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, IsUrl, isURL } from 'class-validator'

const validateURL = {
  message: '请更正为正确的网址',
  validator: (v: string | Array<string>): boolean => {
    if (!v) {
      return true
    }
    if (Array.isArray(v)) {
      return v.every((url) => isURL(url, { require_protocol: true }))
    }
    if (!isURL(v, { require_protocol: true })) {
      return false
    }
    return true
  },
}

@modelOptions({
  options: {
    customName: 'Project',
  },
})
export class ProjectModel extends BaseModel {
  @prop({ required: true, unique: true })
  @IsString()
  name: string

  @prop({
    validate: validateURL,
  })
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.length > 0 ? value : null,
  )
  previewUrl?: string

  @prop({
    validate: validateURL,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.length > 0 ? value : null,
  )
  docUrl?: string

  @prop({
    validate: validateURL,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.length > 0 ? value : null,
  )
  projectUrl?: string

  @IsUrl({ require_protocol: true }, { each: true })
  @IsOptional()
  @prop({
    type: String,
    validate: validateURL,
  })
  images?: string[]

  @prop({ required: true })
  @IsString()
  description: string

  @prop({
    validate: validateURL,
  })
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.length > 0 ? value : null,
  )
  @IsOptional()
  avatar?: string

  @prop()
  @IsString()
  text: string
}
