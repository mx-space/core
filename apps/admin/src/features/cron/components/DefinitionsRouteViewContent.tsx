import { useQuery } from '@tanstack/react-query'
import { ListTodo, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CronTaskType, getCronTaskDefinitions } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { definitionQueryKey, definitionStaleTime } from '../constants'
import { useCronMutations } from '../hooks/useCronMutations'
import { DefinitionSkeleton } from './CronPrimitives'
import { DefinitionDetail } from './DefinitionDetail'
import { DefinitionListRow } from './DefinitionListRow'

const FOCUS_SCOPE_ID = 'cron-definitions'

export function DefinitionsRouteViewContent() {
  const { t } = useI18n()
  const { refreshAll, run } = useCronMutations()
  const [selectedType, setSelectedType] = useState<CronTaskType | null>(null)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)

  const definitionsQuery = useQuery({
    queryFn: getCronTaskDefinitions,
    queryKey: definitionQueryKey,
    staleTime: definitionStaleTime,
  })

  const definitions = definitionsQuery.data ?? []
  const selectedDefinition =
    definitions.find((definition) => definition.type === selectedType) ?? null

  useEffect(() => {
    if (selectedType && !selectedDefinition) {
      setSelectedType(null)
      setShowDetailOnMobile(false)
    }
  }, [selectedDefinition, selectedType])

  useListKeyboard({
    actions: [],
    getId: (definition) => definition.type,
    items: definitions,
    onItemFocus: (id) => {
      setSelectedType(id as CronTaskType)
    },
    resetOn: [],
    scopeId: FOCUS_SCOPE_ID,
  })

  const selectDefinition = (type: CronTaskType) => {
    setSelectedType(type)
    setShowDetailOnMobile(true)
  }

  const requestRun = (type: CronTaskType) => {
    if (window.confirm(t('cron.definitions.confirmRun'))) {
      run.mutate(type)
    }
  }

  return (
    <MasterDetailLayout
      detail={
        <section className="h-full min-h-0">
          {selectedDefinition ? (
            <DefinitionDetail
              definition={selectedDefinition}
              onBack={() => setShowDetailOnMobile(false)}
            />
          ) : (
            <DefinitionDetailEmpty />
          )}
        </section>
      }
      list={
        <FocusScope
          className="outline-hidden flex h-full min-h-0 flex-col"
          id={FOCUS_SCOPE_ID}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
              APP_SHELL_HEADER_HEIGHT_CLASS,
            )}
          >
            <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
              <span className="truncate">{t('cron.definitions.title')}</span>
              <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                {definitions.length}
              </span>
            </h2>
            <Button
              aria-label={t('common.refresh')}
              disabled={definitionsQuery.isFetching}
              iconOnly
              onClick={() => void refreshAll()}
              type="button"
              variant="subtle"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  'size-4',
                  definitionsQuery.isFetching && 'animate-spin',
                )}
              />
            </Button>
          </div>

          <Scroll className="flex-1">
            {definitionsQuery.isLoading && definitions.length === 0 ? (
              <DefinitionSkeleton />
            ) : definitions.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <ListTodo
                  aria-hidden="true"
                  className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
                />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('cron.definitions.empty')}
                </p>
              </div>
            ) : (
              definitions.map((definition) => (
                <DefinitionListRow
                  definition={definition}
                  key={definition.type}
                  onRun={() => requestRun(definition.type)}
                  onSelect={() => selectDefinition(definition.type)}
                  running={run.isPending}
                  selected={selectedType === definition.type}
                />
              ))
            )}
          </Scroll>
        </FocusScope>
      }
      showDetailOnMobile={showDetailOnMobile}
    />
  )
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
