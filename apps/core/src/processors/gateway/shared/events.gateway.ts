import { Injectable } from '@nestjs/common'

import { AdminEventsGateway } from '../admin/events.gateway'
import { WebEventsGateway } from '../web/events.gateway'
import type { BusinessEvents } from '~/constants/business-event.constant'

@Injectable()
export class SharedGateway {
  constructor(
    private readonly admin: AdminEventsGateway,
    private readonly web: WebEventsGateway,
  ) {}

  broadcast(event: BusinessEvents, data: any) {
    this.admin.broadcast(event, data)
    this.web.broadcast(event, data)
  }
}
