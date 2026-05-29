import { FileText, Plus } from 'lucide-react'

import { useI18n } from '~/i18n'
import { ButtonLink } from '~/ui/primitives/button'

export function PagesEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
      <FileText
        aria-hidden="true"
        className="mb-4 size-12 text-neutral-300 dark:text-neutral-700"
      />
      <p>{t('pages.empty.title')}</p>
      <ButtonLink className="mt-4" to="/pages/edit" variant="subtle">
        <Plus aria-hidden="true" className="size-4" />
        {t('pages.empty.create')}
      </ButtonLink>
    </div>
  )
}
