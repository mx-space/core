import { useQuery } from '@tanstack/react-query'
import { ListTodo, RefreshCw } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import type { CronTaskType } from '~/api/cron-tasks'
import { getCronTaskDefinitions } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { definitionQueryKey, definitionStaleTime } from '../constants'
import { useCronMutations } from '../hooks/useCronMutations'
import { DefinitionSkeleton } from './CronPrimitives'
import { DefinitionListRow } from './DefinitionListRow'
import { DefinitionsRouteContext } from './definitions-route-context'

const FOCUS_SCOPE_ID = 'cron-definitions'
const DEFINITIONS_BASE_PATH = '/maintenance/cron'

export function DefinitionsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const decodedId = params.id ? decodeURIComponent(params.id) : null
  const { refreshAll, run } = useCronMutations()

  const definitionsQuery = useQuery({
    queryFn: getCronTaskDefinitions,
    queryKey: definitionQueryKey,
    staleTime: definitionStaleTime,
  })

  const definitions = definitionsQuery.data ?? []
  const selectedType = (decodedId as CronTaskType | null) ?? null

  const closeDetail = useCallback(() => {
    navigate(DEFINITIONS_BASE_PATH)
  }, [navigate])

  const openDefinition = useCallback(
    (type: CronTaskType) => {
      navigate(`${DEFINITIONS_BASE_PATH}/${encodeURIComponent(type)}`)
    },
    [navigate],
  )

  useListKeyboard({
    actions: [],
    getId: (definition) => definition.type,
    items: definitions,
    onItemFocus: (id) => {
      openDefinition(id as CronTaskType)
    },
    resetOn: [],
    scopeId: FOCUS_SCOPE_ID,
  })

  const requestRun = (type: CronTaskType) => {
    if (window.confirm(t('cron.definitions.confirmRun'))) {
      run.mutate(type)
    }
  }

  const routeContextValue = useMemo(
    () => ({
      onBack: closeDetail,
    }),
    [closeDetail],
  )

  return (
    <DefinitionsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        emptyDetail={<DefinitionDetailEmpty />}
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
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
                  <span className="truncate">
                    {t('cron.definitions.title')}
                  </span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {definitions.length}
                  </span>
                </h2>
              </div>
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
                    onSelect={() => openDefinition(definition.type)}
                    running={run.isPending}
                    selected={selectedType === definition.type}
                  />
                ))
              )}
            </Scroll>
          </FocusScope>
        }
      />
    </DefinitionsRouteContext.Provider>
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
