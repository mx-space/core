import { UnprocessableEntityException } from '@nestjs/common'
import { ArgsType, Field, ID } from '@nestjs/graphql'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsDefined, isMongoId, IsMongoId } from 'class-validator'

@ArgsType()
export class MongoIdDto {
  @IsMongoId()
  @ApiProperty({ example: '5e6f67e75b303781d2807278' })
  @Field(() => ID)
  id: string
}

export class IntIdOrMongoIdDto {
  @IsDefined()
  @Transform(({ value }) => {
    if (isMongoId(value)) {
      return value
    }
    const nid = +value
    if (!isNaN(nid)) {
      return nid
    }
    throw new UnprocessableEntityException('Invalid id')
  })
  @ApiProperty({ example: [12, '5e6f67e75b303781d2807278'] })
  id: string | number
}
