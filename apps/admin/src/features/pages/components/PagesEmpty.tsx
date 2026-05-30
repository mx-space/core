import { FileText, Plus } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { ButtonLink } from '~/ui/primitives/button'

export function PagesEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        action={
          <ButtonLink to="/pages/edit" variant="subtle">
            <Plus aria-hidden="true" className="size-4" />
            {t('pages.empty.create')}
          </ButtonLink>
        }
        icon={FileText}
        title={t('pages.empty.title')}
      />
    </div>
  )
}
