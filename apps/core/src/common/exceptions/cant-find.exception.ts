import { NotFoundException } from '@nestjs/common'
import { sample } from 'lodash'

export const NotFoundMessage = [
  '真不巧，内容走丢了 o(╥﹏╥)o',
  '电波无法到达 ωω',
  '数据..不小心丢失了啦 π_π',
  '404, 这也不是我的错啦 (๐•̆ ·̭ •̆๐)',
  '嘿，这里空空如也，不如别处走走？',
]

export class CannotFindException extends NotFoundException {
  constructor() {
    super(sample(NotFoundMessage))
  }
}
