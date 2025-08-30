import { IsEmail, IsIn, IsString } from 'class-validator'
import { SubscribeTypeToBitMap } from './subscribe.constant'

export class SubscribeDto {
  @IsEmail()
  email: string

  @IsIn(Object.keys(SubscribeTypeToBitMap), { each: true })
  types: string[]
}

export class CancelSubscribeDto {
  @IsEmail()
  email: string

  @IsString()
  cancelToken: string
}
