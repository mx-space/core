import { useEffect } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { EnrichmentProviderMeta } from '~/models/enrichment'
import { DesktopSidebarHamburger } from '~/ui/layout/desktop-sidebar-hamburger'
import { MobileHamburger } from '~/ui/layout/mobile-hamburger'
import { useShellNav } from '~/ui/layout/shell-nav-context'
import { Popover } from '~/ui/overlay/popover'
import { TabList } from '~/ui/patterns/TabList'
import { cn } from '~/utils/cn'

import type { EnrichmentSource } from '../types/enrichment'

export function EnrichmentHeader(props: {
  onSourceChange: (source: EnrichmentSource) => void
  providers: EnrichmentProviderMeta[] | null
  source: EnrichmentSource
}) {
  const { t } = useI18n()
  const shellNav = useShellNav()
  const registerPageHeader = shellNav?.registerPageHeader
  useEffect(() => registerPageHeader?.(), [registerPageHeader])

  const items = [
    { key: 'cache' as const, label: t('enrichment.source.cache') },
    { key: 'screenshots' as const, label: t('enrichment.source.screenshots') },
    { key: 'probe' as const, label: t('enrichment.source.probe') },
  ]

  return (
    <header
      className={cn(
        'flex shrink-0 items-stretch gap-2 border-b border-border bg-surface-page px-4',
        APP_SHELL_HEADER_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <MobileHamburger />
        <DesktopSidebarHamburger />
        <h1 className="truncate text-base font-semibold text-fg max-sm:hidden">
          {t('routes.enrichment.title')}
        </h1>
      </div>
      <TabList<EnrichmentSource>
        activeKey={props.source}
        ariaLabel={t('enrichment.source.aria')}
        className="ml-1"
        items={items}
        onSelect={props.onSourceChange}
      />
      {props.providers && props.providers.length > 0 ? (
        <ProviderStatus providers={props.providers} />
      ) : null}
    </header>
  )
}

function ProviderStatus(props: { providers: EnrichmentProviderMeta[] }) {
  const { t } = useI18n()
  const ready = props.providers.filter((provider) => provider.ready).length
  const total = props.providers.length

  return (
    <div className="flex shrink-0 items-center">
      <Popover>
        <Popover.Trigger
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs tabular-nums text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg',
            'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
          )}
          type="button"
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              ready === total ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {t('enrichment.providers.summary', { ready, total })}
        </Popover.Trigger>
        <Popover.Content
          align="end"
          className="p-1.5"
          sideOffset={6}
          width="sm"
        >
          <ul className="flex flex-col">
            {props.providers.map((provider) => (
              <li
                className="flex items-center gap-2 rounded-sm px-2 py-1.5"
                key={provider.name}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    provider.ready
                      ? 'bg-emerald-500'
                      : 'bg-neutral-300 dark:bg-neutral-600',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {provider.displayName}
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">
                  {provider.ready
                    ? t('enrichment.providers.ready')
                    : t('enrichment.providers.notReady')}
                </span>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover>
    </div>
  )
}
