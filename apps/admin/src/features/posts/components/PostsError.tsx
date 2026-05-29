import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function PostsError(props: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('posts.error.loadFailed')}
      </p>
      <Button className="mt-3" onClick={props.onRetry} type="button">
        {t('common.retry')}
      </Button>
    </div>
  )
}
