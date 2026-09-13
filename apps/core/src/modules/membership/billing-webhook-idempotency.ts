import type { BillingWebhookEventRepository } from './billing-webhook-event.repository'

export async function applyWebhookEventOnce(
  repository: BillingWebhookEventRepository,
  input: { provider: string; eventId: string; type: string; payload: unknown },
  apply: () => Promise<boolean>,
): Promise<{ applied: boolean }> {
  let row = await repository.create(input)
  if (!row) {
    row = await repository.findByProviderAndEventId(
      input.provider,
      input.eventId,
    )
    if (!row || row.processedAt) return { applied: false }
  }
  const applied = await apply()
  await repository.markProcessed(row.id, new Date())
  return { applied }
}
