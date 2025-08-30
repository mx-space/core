import { UnprocessableEntityException } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsDefined, IsMongoId, isMongoId } from 'class-validator'

export class MongoIdDto {
  @IsMongoId()
  id: string
}

export class IntIdOrMongoIdDto {
  @IsDefined()
  @Transform(({ value }) => {
    if (isMongoId(value)) {
      return value
    }
    const nid = +value
    if (!Number.isNaN(nid)) {
      return nid
    }
    throw new UnprocessableEntityException('Invalid id')
  })
  id: string | number
}
