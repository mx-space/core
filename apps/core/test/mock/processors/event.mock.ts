import { EventEmitter2 } from '@nestjs/event-emitter'
import { defineProviders } from 'test/helper/defineProvider'

import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ConfigVersionService } from '~/processors/redis/config-version.service'

export const eventEmitterProvider = defineProviders([
  {
    provide: EventEmitter2,
    useValue: {
      emit(_event, _data) {
        return true
      },
    },
  },
  {
    provide: ConfigVersionService,
    useValue: {
      async bump() {
        return 0
      },
      async getVersion(_scope, fallback = 0) {
        return fallback
      },
      async getVersions(scopes, fallback = {}) {
        return Object.fromEntries(
          scopes.map((scope) => [scope, fallback[scope] ?? 0]),
        )
      },
    },
  },
  {
    provide: EventManagerService,
    useValue: {
      async broadcast(_event, _data) {},
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
