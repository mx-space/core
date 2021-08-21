import { Injectable } from '@nestjs/common'
import { AdminEventsGateway } from '../admin/events.gateway'
import { EventTypes } from '../events.types'
import { WebEventsGateway } from '../web/events.gateway'

@Injectable()
export class SharedGateway {
  constructor(
    private readonly admin: AdminEventsGateway,
    private readonly web: WebEventsGateway,
  ) {}

  async broadcase(event: EventTypes, data: any) {
    await this.admin.broadcast(event, data)
    await this.web.broadcast(event, data)
  }
}
