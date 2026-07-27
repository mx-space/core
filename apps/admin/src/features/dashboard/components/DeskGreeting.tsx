import { NotebookPen, PenLine, Zap } from 'lucide-react'
import { useMemo } from 'react'

import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { ButtonLink } from '~/ui/primitives/button'

import { resolveGreetingKey } from '../utils/desk'

export function DeskGreeting(props: { ownerName?: string }) {
  const { format, t } = useI18n()
  const now = useMemo(() => new Date(), [])
  const greeting = t(resolveGreetingKey(now.getHours()))

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <MobileHeaderAffordance />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-fg">
            {props.ownerName
              ? t('dashboard.desk.greeting.withName', {
                  greeting,
                  name: props.ownerName,
                })
              : greeting}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {format.dateTime(now, { dateStyle: 'full', timeStyle: undefined })}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ButtonLink to="/posts/edit">
          <PenLine aria-hidden="true" className="size-4" />
          {t('dashboard.desk.action.post')}
        </ButtonLink>
        <ButtonLink to="/notes/edit" variant="subtle">
          <NotebookPen aria-hidden="true" className="size-4" />
          {t('dashboard.desk.action.note')}
        </ButtonLink>
        <ButtonLink to="/recently?create=1" variant="subtle">
          <Zap aria-hidden="true" className="size-4" />
          {t('dashboard.desk.action.recently')}
        </ButtonLink>
      </div>
    </header>
  )
}
