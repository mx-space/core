import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type {
  CacheFilterMode,
  CaptureSortField,
  EnrichmentSource,
  ProbeHistoryEntry,
  SortOrder,
} from '../types/enrichment'

import {
  getEnrichmentCaptureQuota,
  getEnrichmentCaptures,
  getEnrichmentList,
  getEnrichmentProviders,
} from '~/api/enrichment'
import { useI18n } from '~/i18n'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { defaultPageSize, enrichmentQueryKey } from '../constants'
import { formatBytes, isEnrichmentSource } from '../utils/enrichment'
import { CacheDetailPanel } from './CacheDetailPanel'
import { CacheListPanel } from './CacheListPanel'
import { CaptureDetail } from './CaptureDetail'
import { CaptureListPanel } from './CaptureListPanel'
import { DetailEmpty } from './EnrichmentPrimitives'
import { ProbeConsole } from './ProbeConsole'
import { ProbeListPanel } from './ProbeListPanel'
import {
  CaptureControls,
  FilterSegment,
  ProviderStatusBar,
  SourceSwitcher,
} from './SourceSwitcher'

export function EnrichmentRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const initialSourceParam = searchParams.get('source')
  const initialSource = isEnrichmentSource(initialSourceParam)
    ? initialSourceParam
    : 'cache'
  const initialSelectedId = searchParams.get('id')
  const [source, setSource] = useState<EnrichmentSource>(initialSource)
  const [selectedCacheId, setSelectedCacheId] = useState<string | null>(
    initialSource === 'cache' ? initialSelectedId : null,
  )
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(
    initialSource === 'screenshots' ? initialSelectedId : null,
  )
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(
    Boolean(initialSelectedId),
  )
  const [cachePage, setCachePage] = useState(1)
  const [cachePageSize, setCachePageSize] = useState(defaultPageSize)
  const [capturePage, setCapturePage] = useState(1)
  const [capturePageSize, setCapturePageSize] = useState(defaultPageSize)
  const [filterMode, setFilterMode] = useState<CacheFilterMode>('all')
  const [captureSort, setCaptureSort] =
    useState<CaptureSortField>('last_accessed')
  const [captureOrder, setCaptureOrder] = useState<SortOrder>('desc')
  const [probeHistory, setProbeHistory] = useState<ProbeHistoryEntry[]>([])

  const cacheQuery = useQuery({
    enabled: source === 'cache',
    placeholderData: (previous) => previous,
    queryFn: () =>
      getEnrichmentList({
        onlyFailed: filterMode === 'failed',
        page: cachePage,
        size: cachePageSize,
      }),
    queryKey: [
      ...enrichmentQueryKey,
      'cache',
      { filterMode, page: cachePage, size: cachePageSize },
    ],
  })

  const captureQuery = useQuery({
    enabled: source === 'screenshots',
    placeholderData: (previous) => previous,
    queryFn: () =>
      getEnrichmentCaptures({
        order: captureOrder,
        page: capturePage,
        size: capturePageSize,
        sort: captureSort,
      }),
    queryKey: [
      ...enrichmentQueryKey,
      'captures',
      {
        order: captureOrder,
        page: capturePage,
        size: capturePageSize,
        sort: captureSort,
      },
    ],
  })

  const quotaQuery = useQuery({
    enabled: source === 'screenshots',
    queryFn: getEnrichmentCaptureQuota,
    queryKey: [...enrichmentQueryKey, 'captures', 'quota'],
    staleTime: 30_000,
  })

  const providersQuery = useQuery({
    enabled: source === 'cache',
    queryFn: getEnrichmentProviders,
    queryKey: [...enrichmentQueryKey, 'providers'],
    staleTime: 30_000,
  })

  const cacheRows = cacheQuery.data?.data ?? []
  const cachePager = cacheQuery.data?.pagination
  const selectedCache =
    cacheRows.find((row) => row.id === selectedCacheId) ?? null
  const captureRows = captureQuery.data?.data ?? []
  const capturePager = captureQuery.data?.pagination
  const selectedCapture =
    captureRows.find((row) => row.enrichmentId === selectedCaptureId) ?? null
  const selectedProbe =
    probeHistory.find((entry) => entry.id === selectedProbeId) ?? null

  useLayoutEffect(() => {
    const nextSourceParam = searchParams.get('source')
    const nextSource = isEnrichmentSource(nextSourceParam)
      ? nextSourceParam
      : 'cache'
    const nextSelectedId = searchParams.get('id')

    setSource((value) => (value === nextSource ? value : nextSource))
    setSelectedProbeId(null)

    if (nextSource === 'cache') {
      setSelectedCacheId((value) =>
        value === nextSelectedId ? value : nextSelectedId,
      )
      setSelectedCaptureId(null)
    } else if (nextSource === 'screenshots') {
      setSelectedCacheId(null)
      setSelectedCaptureId((value) =>
        value === nextSelectedId ? value : nextSelectedId,
      )
    } else {
      setSelectedCacheId(null)
      setSelectedCaptureId(null)
    }

    setShowDetailOnMobile(Boolean(nextSelectedId) && nextSource !== 'probe')
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams()
    const selectedId =
      source === 'cache'
        ? selectedCacheId
        : source === 'screenshots'
          ? selectedCaptureId
          : null

    if (source !== 'cache') next.set('source', source)
    if (selectedId) next.set('id', selectedId)

    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
  }, [
    searchParamsKey,
    selectedCacheId,
    selectedCaptureId,
    setSearchParams,
    source,
  ])

  const setSourceAndReset = (next: EnrichmentSource) => {
    setSource(next)
    setSelectedCacheId(null)
    setSelectedCaptureId(null)
    setSelectedProbeId(null)
    setShowDetailOnMobile(false)
  }

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: enrichmentQueryKey })
  }

  return (
    <MasterDetailLayout
      showDetailOnMobile={showDetailOnMobile}
      list={
        <section className="flex h-full min-h-0 flex-col">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <SourceSwitcher onChange={setSourceAndReset} value={source} />
            {source === 'cache' ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <FilterSegment
                    onChange={(next) => {
                      setFilterMode(next)
                      setCachePage(1)
                    }}
                    value={filterMode}
                  />
                  {providersQuery.data ? (
                    <ProviderStatusBar providers={providersQuery.data} />
                  ) : null}
                </div>
                <Button
                  disabled={cacheQuery.isFetching}
                  onClick={() => void cacheQuery.refetch()}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      cacheQuery.isFetching && 'animate-spin',
                    )}
                  />
                  {t('common.refresh')}
                </Button>
              </div>
            ) : null}
            {source === 'screenshots' ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <CaptureControls
                  onOrderChange={(next) => {
                    setCaptureOrder(next)
                    setCapturePage(1)
                  }}
                  onSortChange={(next) => {
                    setCaptureSort(next)
                    setCapturePage(1)
                  }}
                  order={captureOrder}
                  sort={captureSort}
                />
                <Button
                  disabled={captureQuery.isFetching}
                  onClick={() => {
                    void captureQuery.refetch()
                    void quotaQuery.refetch()
                  }}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      captureQuery.isFetching && 'animate-spin',
                    )}
                  />
                  {t('common.refresh')}
                </Button>
              </div>
            ) : null}
          </div>

          {source === 'cache' ? (
            <CacheListPanel
              filterMode={filterMode}
              loading={cacheQuery.isLoading}
              onPageChange={setCachePage}
              onPageSizeChange={(size) => {
                setCachePageSize(size)
                setCachePage(1)
              }}
              onSelect={(row) => {
                setSelectedCacheId(row.id)
                setShowDetailOnMobile(true)
              }}
              page={cachePage}
              pageCount={cachePager?.totalPage ?? 1}
              pageSize={cachePageSize}
              rows={cacheRows}
              selectedId={selectedCacheId}
              total={cachePager?.total ?? 0}
            />
          ) : null}

          {source === 'screenshots' ? (
            <CaptureListPanel
              loading={captureQuery.isLoading}
              onPageChange={setCapturePage}
              onPageSizeChange={(size) => {
                setCapturePageSize(size)
                setCapturePage(1)
              }}
              onSelect={(row) => {
                setSelectedCaptureId(row.enrichmentId)
                setShowDetailOnMobile(true)
              }}
              page={capturePage}
              pageCount={capturePager?.totalPage ?? 1}
              pageSize={capturePageSize}
              quota={
                quotaQuery.data
                  ? `${formatBytes(quotaQuery.data.used.totalBytes)} / ${formatBytes(
                      quotaQuery.data.cap.maxTotalBytes,
                    )}`
                  : null
              }
              rows={captureRows}
              selectedId={selectedCaptureId}
              total={capturePager?.total ?? 0}
            />
          ) : null}

          {source === 'probe' ? (
            <ProbeListPanel
              history={probeHistory}
              onClear={() => {
                setProbeHistory([])
                setSelectedProbeId(null)
                setShowDetailOnMobile(false)
              }}
              onSelect={(entry) => {
                setSelectedProbeId(entry.id)
                setShowDetailOnMobile(true)
              }}
              selectedId={selectedProbeId}
            />
          ) : null}
        </section>
      }
      detail={
        <section className="min-h-0">
          {source === 'cache' ? (
            selectedCacheId ? (
              <CacheDetailPanel
                fallback={selectedCache}
                id={selectedCacheId}
                invalidateAll={invalidateAll}
                onBack={() => setShowDetailOnMobile(false)}
                onJumpToScreenshot={(id) => {
                  setSource('screenshots')
                  setSelectedCacheId(null)
                  setSelectedCaptureId(id)
                  setSelectedProbeId(null)
                  setShowDetailOnMobile(true)
                }}
              />
            ) : (
              <DetailEmpty label={t('enrichment.detail.emptyCache')} />
            )
          ) : null}

          {source === 'screenshots' ? (
            selectedCapture ? (
              <CaptureDetail
                invalidateAll={invalidateAll}
                onDeleted={(id) => {
                  if (selectedCaptureId === id) {
                    setSelectedCaptureId(null)
                    setShowDetailOnMobile(false)
                  }
                }}
                onBack={() => setShowDetailOnMobile(false)}
                quota={quotaQuery.data ?? null}
                row={selectedCapture}
              />
            ) : (
              <DetailEmpty label={t('enrichment.detail.emptyCapture')} />
            )
          ) : null}

          {source === 'probe' ? (
            <ProbeConsole
              onProbed={(entry) => {
                setProbeHistory((current) => [entry, ...current].slice(0, 20))
                setSelectedProbeId(entry.id)
                setShowDetailOnMobile(true)
              }}
              onBack={() => setShowDetailOnMobile(false)}
              selected={selectedProbe}
            />
          ) : null}
        </section>
      }
    />
  )
}
