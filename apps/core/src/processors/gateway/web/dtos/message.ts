import { IsEnum, IsObject } from 'class-validator'

export enum SupportedMessageEvent {
  Join = 'join',
  Leave = 'leave',
  UpdateSid = 'updateSid',
}
export class MessageEventDto {
  @IsEnum(SupportedMessageEvent)
  type: SupportedMessageEvent
  @IsObject()
  payload: unknown
}
