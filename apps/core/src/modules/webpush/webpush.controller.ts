import { IsString } from 'class-validator'
import { sendNotification } from 'web-push'
import type { PushSubscription } from 'web-push'

import { nanoid } from '@mx-space/external'
import { Body, Controller, Post } from '@nestjs/common'

import { WebpushSubscriptionDto } from './webpush.dto'

const subscriptions = {} as Record<string, PushSubscription>

class SubDto {
  @IsString()
  subId: string
}

@Controller('webpush')
export class WebpushController {
  @Post('subscribe')
  subscribe(@Body() body: WebpushSubscriptionDto) {
    const subId = nanoid.nanoid()
    subscriptions[subId] = body
    return { id: subId }
  }

  @Post('test')
  async testSend(@Body() { subId }: SubDto) {
    console.log(subscriptions[subId], subId, subscriptions)
    sendNotification(
      JSON.parse(JSON.stringify(subscriptions[subId])),
      JSON.stringify({ title: 'Test', body: 'Test message' }),
    ).catch((err) => {
      console.log(err)
    })
  }
}
