import { useQuery } from '@tanstack/react-query'

import { getMembershipPlans } from '~/api/membership'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Switch } from '~/ui/primitives/switch'

import { FreeWindowSection } from './FreeWindowSection'
import { parseFreeWindowHours } from './paywall-meta'
import { PaywallPositionSection } from './PaywallPositionSection'
import { derivePremiumStatus } from './premium-status'
import { PremiumStatusLine } from './PremiumStatusLine'
import { UnlockMethodsSection } from './UnlockMethodsSection'

export interface PremiumFormValues {
  content: string
  contentFormat: string
  freeUntil: string
  freeWindowHours: string
  isPremium: boolean
  previewBlocks: string
  purchaseEnabled: boolean
}

type UpdatePremiumField = ((
  key: 'isPremium' | 'purchaseEnabled',
  value: boolean,
) => void) &
  ((
    key: 'freeUntil' | 'freeWindowHours' | 'previewBlocks',
    value: string,
  ) => void)

export function PremiumArticlePanel(props: {
  isPublished: boolean
  updateField: UpdatePremiumField
  values: PremiumFormValues
}) {
  const { t } = useI18n()
  const { updateField, values } = props
  const plansQuery = useQuery({
    enabled: values.isPremium,
    queryFn: getMembershipPlans,
    queryKey: adminQueryKeys.settings.membershipPlans(),
  })
  const lexical = values.contentFormat === 'lexical'
  const status = derivePremiumStatus(
    {
      freeUntil: values.freeUntil || undefined,
      freeWindowHours: parseFreeWindowHours(values.freeWindowHours),
      isPublished: props.isPublished,
      previewBlocks: Number(values.previewBlocks) || undefined,
    },
    new Date(),
  )

  return (
    <div className="grid gap-4">
      <Switch
        checked={values.isPremium}
        description={
          lexical
            ? t('write.premium.description')
            : t('write.postFields.premiumRequiresLexical')
        }
        disabled={!lexical}
        label={t('write.postFields.premium')}
        onCheckedChange={(checked) => updateField('isPremium', checked)}
      />
      {values.isPremium ? (
        <>
          <PremiumStatusLine status={status} />
          <FreeWindowSection
            freeUntil={values.freeUntil}
            freeWindowHours={values.freeWindowHours}
            onFreeUntilChange={(value) => updateField('freeUntil', value)}
            onFreeWindowHoursChange={(value) =>
              updateField('freeWindowHours', value)
            }
            status={status}
          />
          <PaywallPositionSection
            content={values.content}
            onChange={(value) => updateField('previewBlocks', value)}
            previewBlocks={values.previewBlocks}
          />
          <UnlockMethodsSection
            onChange={(value) => updateField('purchaseEnabled', value)}
            plans={plansQuery.data}
            purchaseEnabled={values.purchaseEnabled}
          />
        </>
      ) : null}
    </div>
  )
}
