import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function NotesError(props: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('notes.error.loadFailed')}
      </p>
      <Button className="mt-3" onClick={props.onRetry} type="button">
        {t('common.retry')}
      </Button>
    </div>
  )
}
