import { EventEmitter2 } from '@nestjs/event-emitter'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'
import { defineProviders } from 'test/helper/defineProvider'

export const eventEmitterProvider = defineProviders([
  {
    provide: EventEmitter2,
    useValue: {
      emit(event, data) {
        return true
      },
    },
  },
  {
    provide: SubPubBridgeService,
    useValue: {
      async publish(event, data) {},
      async subscribe(event, callback) {},
      async unsubscribe(event, callback) {},
    },
  },
  {
    provide: EventManagerService,
    useValue: {
      async broadcast(event, data) {},
      async emit() {},
      on() {
        return noop
      },
      registerHandler() {
        return noop
      },
    },
  },
])

const noop = () => {}
