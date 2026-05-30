import { Database, Upload } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'

export function BackupListEmptyState(props: {
  onCreate: () => void
  onRestore: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center py-24">
      <EmptyState
        action={
          <div className="flex items-center gap-2">
            <Button onClick={props.onCreate} type="button">
              {t('backup.actions.createNow')}
            </Button>
            <Button onClick={props.onRestore} type="button" variant="subtle">
              <Upload aria-hidden="true" className="size-4" />
              {t('backup.actions.uploadRestore')}
            </Button>
          </div>
        }
        description={t('backup.listEmpty.description')}
        icon={Database}
        title={t('backup.listEmpty.title')}
      />
    </div>
  )
}
