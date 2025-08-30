import { PartialType } from '@nestjs/mapped-types'
import { modelOptions, prop } from '@typegoose/typegoose'
import { PAGE_COLLECTION_NAME } from '~/constants/db.constant'
import { IsNilOrString } from '~/decorators/dto/isNilOrString'
import { WriteBaseModel } from '~/shared/model/write-base.model'
import { Transform } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

@modelOptions({
  options: {
    customName: PAGE_COLLECTION_NAME,
  },
})
export class PageModel extends WriteBaseModel {
  @prop({ trim: 1, index: true, required: true, unique: true })
  @IsString()
  @IsNotEmpty()
  slug!: string

  @prop({ trim: true, type: String })
  @IsString()
  @IsOptional()
  @IsNilOrString()
  subtitle?: string | null

  @prop({ default: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value))
  order!: number
}

export class PartialPageModel extends PartialType(PageModel) {}
