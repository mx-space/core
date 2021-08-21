import { ApiProperty } from '@nestjs/swagger'
import { IsMongoId } from 'class-validator'
import { IsBooleanOrString } from '~/utils/validator/isBooleanOrString'

export class MongoIdDto {
  @IsMongoId()
  @ApiProperty({
    name: 'id',
    // enum: ['5e6f67e75b303781d2807279', '5e6f67e75b303781d280727f'],
    example: '5e6f67e75b303781d2807278',
  })
  id: string
}

export class IntIdOrMongoIdDto {
  @IsBooleanOrString()
  @ApiProperty({ example: ['12', '5e6f67e75b303781d2807278'] })
  id: string | number
}
