import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { CompanionDeviceRepository } from './companion-device.repository'
import {
  COMPANION_PRESENCE_REVOCATION_PORT,
  type CompanionPresenceRevocationPort,
} from './companion-presence-revocation.port'

const RECONCILE_INTERVAL_MS = 5_000
const RECONCILE_BATCH_SIZE = 100

@Injectable()
export class CompanionDeviceReconciler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CompanionDeviceReconciler.name)
  private timer?: ReturnType<typeof setInterval>
  private running = false

  constructor(
    private readonly repository: CompanionDeviceRepository,
    @Inject(COMPANION_PRESENCE_REVOCATION_PORT)
    private readonly presenceRevocation: CompanionPresenceRevocationPort,
  ) {}

  onModuleInit() {
    void this.reconcile()
    this.timer = setInterval(() => void this.reconcile(), RECONCILE_INTERVAL_MS)
    this.timer.unref?.()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async reconcile(now = new Date()) {
    if (this.running) return
    this.running = true

    try {
      const pending =
        await this.repository.listDevicesPendingPresenceClear(
          RECONCILE_BATCH_SIZE,
        )

      for (const device of pending) {
        try {
          await this.presenceRevocation.removeDevice(device.id)
          await this.repository.markPresenceCleared(device.id, now)
        } catch (error) {
          this.logger.warn(
            `Companion device presence reconciliation failed for ${device.id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    } catch (error) {
      this.logger.warn(
        `Companion device presence reconciliation scan failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      this.running = false
    }
  }
}
