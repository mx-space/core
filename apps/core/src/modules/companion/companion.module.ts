import { Module } from '@nestjs/common'

import { CompanionController } from './companion.controller'
import { CompanionCredentialService } from './companion-credential.service'
import { CompanionDeviceController } from './companion-device.controller'
import { CompanionDeviceGuard } from './companion-device.guard'
import { CompanionDeviceReconciler } from './companion-device.reconciler'
import { CompanionDeviceRepository } from './companion-device.repository'
import { CompanionDeviceService } from './companion-device.service'
import { CompanionPresenceController } from './companion-presence.controller'
import { CompanionPresenceReaper } from './companion-presence.reaper'
import { CompanionPresenceStore } from './companion-presence.store'
import {
  CompanionPresenceRateLimiter,
  CompanionPresenceTransportGuard,
} from './companion-presence.transport'
import { COMPANION_PRESENCE_REVOCATION_PORT } from './companion-presence-revocation.port'

@Module({
  controllers: [
    CompanionController,
    CompanionDeviceController,
    CompanionPresenceController,
  ],
  providers: [
    CompanionCredentialService,
    CompanionDeviceGuard,
    CompanionDeviceReconciler,
    CompanionDeviceRepository,
    CompanionDeviceService,
    CompanionPresenceRateLimiter,
    CompanionPresenceTransportGuard,
    CompanionPresenceReaper,
    CompanionPresenceStore,
    {
      provide: COMPANION_PRESENCE_REVOCATION_PORT,
      useExisting: CompanionPresenceStore,
    },
  ],
  exports: [
    CompanionCredentialService,
    CompanionDeviceGuard,
    CompanionDeviceRepository,
    CompanionDeviceService,
    CompanionPresenceStore,
  ],
})
export class CompanionModule {}
