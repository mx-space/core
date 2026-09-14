import { Check, Minus } from 'lucide-react'

import type { MembershipPlansResponse } from '~/api/membership'
import { useI18n } from '~/i18n'
import { FormSwitch } from '~/ui/primitives/switch'

function formatPrice(price?: { amount: number; currency: string }) {
  if (!price) return null
  return new Intl.NumberFormat(undefined, {
    currency: price.currency,
    style: 'currency',
  }).format(price.amount / 100)
}

export function UnlockMethodsSection(props: {
  onChange: (value: boolean) => void
  plans: MembershipPlansResponse | undefined
  purchaseEnabled: boolean
}) {
  const { t } = useI18n()
  const sponsorEnabled = Boolean(props.plans?.enabled)
  const purchaseAvailable = Boolean(props.plans?.articlePurchase?.enabled)
  const price = formatPrice(props.plans?.articlePurchase?.price)

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-fg">
        {t('write.premium.unlock.title')}
      </span>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="min-w-0">
          <span className="block text-fg">
            {t('write.premium.unlock.sponsor')}
          </span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            {sponsorEnabled
              ? t('write.premium.unlock.sponsorHint')
              : t('write.premium.unlock.sponsorDisabled')}
          </span>
        </span>
        {sponsorEnabled ? (
          <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />
        ) : (
          <Minus
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-subtle"
          />
        )}
      </div>
      <FormSwitch
        checked={purchaseAvailable && props.purchaseEnabled}
        description={
          purchaseAvailable
            ? price
              ? t('write.premium.unlock.purchaseHint', { price })
              : t('write.premium.unlock.purchasePriceUnset')
            : t('write.premium.unlock.purchaseDisabled')
        }
        disabled={!purchaseAvailable}
        label={t('write.premium.unlock.purchase')}
        onCheckedChange={props.onChange}
      />
    </div>
  )
}
