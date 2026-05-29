import { useEffect, useMemo, useState } from 'react'
import type { ExportConfig } from '../../types/markdown'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { ExportOptionsGrid } from './ExportOptionsGrid'
import { ExportTrigger } from './ExportTrigger'

const CONFIG_STORAGE_KEY = 'markdown.export.config'

const DEFAULT_CONFIG: ExportConfig = {
  filenameSlug: false,
  includeYAMLHeader: true,
  titleBigTitle: false,
  withMetaJson: true,
}

function readConfig(): ExportConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<ExportConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function ExportPanel() {
  const { t } = useI18n()
  const [config, setConfig] = useState<ExportConfig>(() => readConfig())

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
    } catch {
      // ignore quota / disabled storage
    }
  }, [config])

  const enabledCount = useMemo(
    () => Object.values(config).filter(Boolean).length,
    [config],
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t('markdown.export.openHint')}
        </span>
        <div className="flex-1" />
        <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs tabular-nums text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t('markdown.export.enabledCount', { count: enabledCount })}
        </span>
      </div>

      <Scroll className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <ExportOptionsGrid onChange={setConfig} value={config} />
          <div className="mt-6 flex justify-end border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <ExportTrigger config={config} />
          </div>
        </div>
      </Scroll>
    </section>
  )
}
