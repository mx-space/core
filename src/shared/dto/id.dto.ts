import { Transform } from 'class-transformer'
import { IsDefined, IsMongoId, isMongoId } from 'class-validator'

import { UnprocessableEntityException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'

export class MongoIdDto {
  @IsMongoId()
  @ApiProperty({ example: '5e6f67e75b303781d2807278' })
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
