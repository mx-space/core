import { PartialType } from '@nestjs/swagger'
import { modelOptions, prop } from '@typegoose/typegoose'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, IsUrl, isURL } from 'class-validator'
import { BaseModel } from '~/shared/model/base.model'

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
  @Transform(({ value }) => (value.length ? value : null))
  previewUrl?: string

  @prop({
    validate: validateURL,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @Transform(({ value }) => (value.length ? value : null))
  docUrl?: string

  @prop({
    validate: validateURL,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @Transform(({ value }) => (value.length ? value : null))
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
  @Transform(({ value }) => (value.length ? value : null))
  @IsOptional()
  avatar?: string

  @prop()
  @IsString()
  text: string
}

export class PartialProjectModel extends PartialType(ProjectModel) {}
