import { useQuery } from '@tanstack/react-query'
import type { SnippetModel } from '~/models/snippet'

import { getCompiledCode } from '~/api/serverless'
import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { getErrorMessage } from '../utils/snippets'
import { InlineLoading, Modal } from './SnippetPrimitives'

export function CompiledCodeModal(props: {
  onClose: () => void
  open: boolean
  snippet: SnippetModel | null
}) {
  const { t } = useI18n()
  const query = useQuery({
    enabled: props.open && Boolean(props.snippet?.id),
    queryFn: () => getCompiledCode(String(props.snippet?.id)),
    queryKey: ['serverless', 'compiled', props.snippet?.id],
  })

  return (
    <Modal
      onClose={props.onClose}
      open={props.open}
      title={
        props.snippet?.name
          ? t('snippets.dialog.compiled.titleWithName', {
              name: props.snippet.name,
            })
          : t('snippets.dialog.compiled.title')
      }
    >
      {query.isLoading ? (
        <InlineLoading label={t('snippets.dialog.compiled.loading')} />
      ) : query.isError ? (
        <p className="text-sm text-red-600">
          {getErrorMessage(
            query.error,
            t('snippets.dialog.compiled.loadFailed'),
          )}
        </p>
      ) : (
        <Scroll
          className="rounded border border-neutral-200 bg-neutral-950 dark:border-neutral-800"
          orientation="both"
          viewportClassName="max-h-[70vh]"
        >
          <pre className="p-4 font-mono text-xs leading-5 text-neutral-100">
            {query.data || t('snippets.dialog.compiled.empty')}
          </pre>
        </Scroll>
      )}
    </Modal>
  )
}
