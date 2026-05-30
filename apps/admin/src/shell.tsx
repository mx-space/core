import { useQuery } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { Drawer } from '~/ui/feedback/drawer'
import { FOCUS_SCOPES, FocusScope, useScopeArrowNav } from '~/ui/focus-scope'
import { ShellNavProvider } from '~/ui/layout/shell-nav-context'
import { SidebarBody } from '~/ui/layout/sidebar-body'

import { AITaskStatus, getAiTasks } from './api/ai'
import { useI18n } from './i18n'

export function AdminShell(props: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [navOpen, setNavOpen] = useState(false)
  const pendingAiTasksQuery = useQuery({
    queryFn: () =>
      getAiTasks({
        page: 1,
        size: 1,
        status: AITaskStatus.Pending,
      }),
    queryKey: ['shell', 'ai-tasks', AITaskStatus.Pending],
    refetchInterval: 5000,
  })
  const runningAiTasksQuery = useQuery({
    queryFn: () =>
      getAiTasks({
        page: 1,
        size: 1,
        status: AITaskStatus.Running,
      }),
    queryKey: ['shell', 'ai-tasks', AITaskStatus.Running],
    refetchInterval: 5000,
  })
  const activeAiTaskCount =
    (pendingAiTasksQuery.data?.total ?? 0) +
    (runningAiTasksQuery.data?.total ?? 0)
  const isFetchingAiTaskCount =
    pendingAiTasksQuery.isFetching || runningAiTasksQuery.isFetching

  // Sidebar HJKL / arrow-key navigation. One binding is enough — the hook
  // looks up the scope's DOM element at fire time, so whichever sidebar
  // (desktop aside or mobile Drawer) is currently mounted handles the keys.
  useScopeArrowNav({
    itemSelector: '[data-scope-item="nav"]',
    scopeId: FOCUS_SCOPES.sidebar,
  })

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handle = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setNavOpen(false)
      }
    }
    mql.addEventListener('change', handle)
    return () => mql.removeEventListener('change', handle)
  }, [])

  return (
    <ShellNavProvider open={navOpen} setOpen={setNavOpen}>
      <main className="grid h-screen min-h-0 grid-cols-[minmax(0,1fr)] overflow-hidden bg-surface-page text-fg lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden h-screen min-h-0 flex-col border-r border-border bg-surface-page lg:flex">
          <FocusScope
            className="flex min-h-0 flex-1 flex-col"
            id={FOCUS_SCOPES.sidebar}
          >
            <SidebarBody />
          </FocusScope>
        </aside>

        <section className="flex h-screen min-h-0 min-w-0 flex-col bg-background">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {props.children}
            {activeAiTaskCount > 0 ? (
              <AiTaskFloatingButton
                activeCount={activeAiTaskCount}
                fetching={isFetchingAiTaskCount}
                onClick={() => navigate('/ai/tasks')}
                title={t('shell.aiTask.title')}
                ariaLabel={t('shell.aiTask.ariaLabel', {
                  count: activeAiTaskCount,
                })}
              />
            ) : null}
          </div>
        </section>

        <Drawer
          onClose={() => setNavOpen(false)}
          open={navOpen}
          showHeader={false}
          side="left"
          title={t('common.primaryNavigation')}
          widthClassName="w-[min(85vw,18rem)]"
        >
          <FocusScope
            className="flex min-h-0 flex-1 flex-col"
            id={FOCUS_SCOPES.sidebar}
          >
            <SidebarBody />
          </FocusScope>
        </Drawer>
      </main>
    </ShellNavProvider>
  )
}

function AiTaskFloatingButton(props: {
  activeCount: number
  fetching: boolean
  onClick: () => void
  title: string
  ariaLabel: string
}) {
  return (
    <button
      aria-label={props.ariaLabel}
      className="outline-hidden absolute bottom-4 right-4 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-neutral-950 bg-neutral-950 px-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
      onClick={props.onClick}
      title={props.title}
      type="button"
    >
      <span className="relative inline-flex size-4 items-center justify-center">
        <Sparkles aria-hidden="true" className="size-4" />
        {props.fetching ? (
          <Loader2
            aria-hidden="true"
            className="absolute -right-1 -top-1 size-2.5 animate-spin"
          />
        ) : null}
      </span>
      <span>{props.title}</span>
      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-neutral-950 dark:bg-neutral-950 dark:text-white">
        {props.activeCount > 99 ? '99+' : props.activeCount}
      </span>
    </button>
  )
}
