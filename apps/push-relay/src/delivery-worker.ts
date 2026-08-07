import { DataVault } from './crypto.js'
import type { ApnsProvider, PushRelayStore } from './types.js'

export class DeliveryWorker {
  private readonly vault: DataVault
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly store: PushRelayStore,
    private readonly provider: ApnsProvider,
    dataKey: string,
  ) {
    this.vault = new DataVault(dataKey)
  }

  start(intervalMs = 1_000) {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), intervalMs)
    this.timer.unref()
    void this.tick()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick(now = new Date()) {
    if (this.running) return
    this.running = true
    try {
      const deliveries = await this.store.claimDeliveries(25, now)
      await Promise.all(
        deliveries.map(async (delivery) => {
          try {
            const result = await this.provider.send({
              appId: delivery.appId,
              environment: delivery.apnsEnvironment,
              deviceToken: this.vault.decrypt(delivery.tokenCiphertext),
              event: delivery.event,
            })
            const completedAt = new Date()
            if (result.status >= 200 && result.status < 300) {
              await this.store.completeDelivery(
                delivery.id,
                result.apnsId,
                completedAt,
              )
              return
            }

            const message = `${result.status}:${result.reason ?? 'APNs rejected delivery'}`
            if (
              result.status === 410 ||
              result.reason === 'BadDeviceToken' ||
              result.reason === 'Unregistered'
            ) {
              await this.store.revokeInstallation(
                delivery.installationId,
                completedAt,
              )
              await this.store.failDelivery(delivery.id, message, completedAt)
            } else if (
              (result.status === 429 || result.status >= 500) &&
              delivery.attempt < 8
            ) {
              const delaySeconds = Math.min(2 ** delivery.attempt * 15, 60 * 60)
              await this.store.retryDelivery(
                delivery.id,
                message,
                new Date(completedAt.getTime() + delaySeconds * 1000),
                completedAt,
              )
            } else {
              await this.store.failDelivery(delivery.id, message, completedAt)
            }
          } catch (error) {
            const failedAt = new Date()
            const message =
              error instanceof Error ? error.message : String(error)
            if (delivery.attempt < 8) {
              const delaySeconds = Math.min(2 ** delivery.attempt * 15, 60 * 60)
              await this.store.retryDelivery(
                delivery.id,
                message,
                new Date(failedAt.getTime() + delaySeconds * 1000),
                failedAt,
              )
            } else {
              await this.store.failDelivery(delivery.id, message, failedAt)
            }
          }
        }),
      )
    } finally {
      this.running = false
    }
  }
}
