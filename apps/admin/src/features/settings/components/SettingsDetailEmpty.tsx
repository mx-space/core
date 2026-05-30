import { SlidersHorizontal } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function SettingsDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] items-center justify-center px-4">
      <EmptyState icon={SlidersHorizontal} title={t('settings.shell.title')} />
    </div>
  )
}
