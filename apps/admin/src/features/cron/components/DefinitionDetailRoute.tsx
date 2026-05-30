import { useQuery } from '@tanstack/react-query'
import { ListTodo } from 'lucide-react'
import { useParams } from 'react-router'

import { CronTaskType, getCronTaskDefinitions } from '~/api/cron-tasks'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { useI18n } from '~/i18n'

import { definitionQueryKey, definitionStaleTime } from '../constants'
import { DefinitionDetail } from './DefinitionDetail'
import { useDefinitionsRouteContext } from './definitions-route-context'

const TYPE_VALUES = new Set<string>(Object.values(CronTaskType))

export function DefinitionDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const ctx = useDefinitionsRouteContext()

  const definitionsQuery = useQuery({
    queryFn: getCronTaskDefinitions,
    queryKey: definitionQueryKey,
    staleTime: definitionStaleTime,
  })

  const decoded = id ? decodeURIComponent(id) : null
  const type =
    decoded && TYPE_VALUES.has(decoded) ? (decoded as CronTaskType) : null

  const definition = type
    ? ((definitionsQuery.data ?? []).find((d) => d.type === type) ?? null)
    : null

  useDocumentTitle(definition?.name ?? type ?? undefined)

  if (!definition) return <DefinitionDetailEmpty />

  return <DefinitionDetail definition={definition} onBack={ctx.onBack} />
}

function DefinitionDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center px-6 text-center">
      <ListTodo
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('cron.definitions.emptyDetail')}
      </p>
    </div>
  )
}

export default DefinitionDetailRoute
