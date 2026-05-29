import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function ListError(props: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('topics.error.list')}
      </p>
      <Button className="mt-3" onClick={props.onRetry} type="button">
        {t('common.retry')}
      </Button>
    </div>
  )
}
