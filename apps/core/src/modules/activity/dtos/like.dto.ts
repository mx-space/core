import { IsEnum } from 'class-validator'

import { MongoIdDto } from '~/shared/dto/id.dto'

import { ActivityLikeSupportType } from '../activity.interface'

export class LikeBodyDto extends MongoIdDto {
  @IsEnum(['Post', 'Note', 'note', 'post'])
  type: ActivityLikeSupportType
}
