import { Database, Upload } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function BackupListEmptyState(props: {
  onCreate: () => void
  onRestore: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Database
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500">{t('backup.listEmpty.title')}</p>
      <p className="mb-4 mt-1 text-xs text-neutral-400">
        {t('backup.listEmpty.description')}
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={props.onCreate} type="button">
          {t('backup.actions.createNow')}
        </Button>
        <Button onClick={props.onRestore} type="button" variant="subtle">
          <Upload aria-hidden="true" className="size-4" />
          {t('backup.actions.uploadRestore')}
        </Button>
      </div>
    </div>
  )
}
