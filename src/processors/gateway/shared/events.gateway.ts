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

  broadcase(event: EventTypes, data: any) {
    this.admin.broadcast(event, data)
    this.web.broadcast(event, data)
  }
}
