import { Transform } from 'class-transformer'
import { IsOptional } from 'class-validator'

import { applyDecorators } from '@nestjs/common'

export const TransformEmptyNull = () => {
  return applyDecorators(
    Transform(({ value: val }) => (String(val).length === 0 ? null : val)),
    IsOptional(),
  )
}
