import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'

import {
  getEnrichmentCaptureQuota,
  getEnrichmentCaptures,
  getEnrichmentList,
  getEnrichmentProviders,
} from '~/api/enrichment'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { AppPage } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { defaultPageSize, enrichmentQueryKey } from '../constants'
import type {
  CacheFilterMode,
  CaptureSortField,
  EnrichmentSource,
  ProbeHistoryEntry,
  SortOrder,
} from '../types/enrichment'
import { formatBytes, isEnrichmentSource } from '../utils/enrichment'
import { CacheListPanel } from './CacheListPanel'
import { CaptureListPanel } from './CaptureListPanel'
import { EnrichmentRouteContext } from './enrichment-route-context'
import { CaptureControls, FilterSegment } from './EnrichmentControls'
import { EnrichmentHeader } from './EnrichmentHeader'
import { DetailEmpty } from './EnrichmentPrimitives'
import { ProbeListPanel } from './ProbeListPanel'

export function EnrichmentRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()

  const onProbeRoute = location.pathname === '/enrichment/probe'
  const detailId = !onProbeRoute && params.id ? params.id : null
  const sourceParam = searchParams.get('source')
  const source: EnrichmentSource = onProbeRoute
    ? 'probe'
    : isEnrichmentSource(sourceParam)
      ? sourceParam
      : 'cache'

  const [cachePage, setCachePage] = useState(1)
  const [cachePageSize, setCachePageSize] = useState(defaultPageSize)
  const [capturePage, setCapturePage] = useState(1)
  const [capturePageSize, setCapturePageSize] = useState(defaultPageSize)
  const [filterMode, setFilterMode] = useState<CacheFilterMode>('all')
  const [captureSort, setCaptureSort] =
    useState<CaptureSortField>('last_accessed')
  const [captureOrder, setCaptureOrder] = useState<SortOrder>('desc')
  const [probeHistory, setProbeHistory] = useState<ProbeHistoryEntry[]>([])
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null)

  const cacheQuery = useQuery({
    enabled: source === 'cache',
    placeholderData: (previous) => previous,
    queryFn: () =>
      getEnrichmentList({
        onlyFailed: filterMode === 'failed',
        page: cachePage,
        size: cachePageSize,
      }),
    queryKey: adminQueryKeys.enrichment.cacheList({
      filterMode,
      page: cachePage,
      size: cachePageSize,
    }),
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
    queryKey: adminQueryKeys.enrichment.captureList({
      order: captureOrder,
      page: capturePage,
      size: capturePageSize,
      sort: captureSort,
    }),
  })

  const quotaQuery = useQuery({
    enabled: source === 'screenshots',
    queryFn: getEnrichmentCaptureQuota,
    queryKey: adminQueryKeys.enrichment.captureQuota(),
    staleTime: 30_000,
  })

  const providersQuery = useQuery({
    queryFn: getEnrichmentProviders,
    queryKey: adminQueryKeys.enrichment.providers(),
    staleTime: 30_000,
  })

  const cacheRows = cacheQuery.data?.data ?? []
  const cachePager = cacheQuery.data?.pagination
  const captureRows = captureQuery.data?.data ?? []
  const capturePager = captureQuery.data?.pagination

  const selectedCacheId = source === 'cache' ? detailId : null
  const selectedCaptureId = source === 'screenshots' ? detailId : null

  const buildListPath = useCallback((next: EnrichmentSource) => {
    if (next === 'probe') return '/enrichment/probe'
    if (next === 'screenshots') return '/enrichment?source=screenshots'
    return '/enrichment'
  }, [])

  const switchSource = useCallback(
    (next: EnrichmentSource) => {
      navigate(buildListPath(next), { replace: true })
    },
    [buildListPath, navigate],
  )

  const closeDetail = useCallback(() => {
    navigate(buildListPath(source), { replace: false })
  }, [buildListPath, navigate, source])

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: enrichmentQueryKey }),
    [queryClient],
  )

  const openCacheRow = useCallback(
    (id: string) => {
      navigate(`/enrichment/${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  const openCaptureRow = useCallback(
    (id: string) => {
      navigate(`/enrichment/${encodeURIComponent(id)}?source=screenshots`)
    },
    [navigate],
  )

  const jumpToScreenshot = useCallback(
    (id: string) => {
      navigate(`/enrichment/${encodeURIComponent(id)}?source=screenshots`)
    },
    [navigate],
  )

  const handleCaptureDeleted = useCallback(
    (id: string) => {
      if (selectedCaptureId === id) {
        navigate('/enrichment?source=screenshots', { replace: true })
      }
    },
    [navigate, selectedCaptureId],
  )

  const pushProbeEntry = useCallback((entry: ProbeHistoryEntry) => {
    setProbeHistory((current) => [entry, ...current].slice(0, 20))
  }, [])

  const routeContextValue = useMemo(
    () => ({
      source,
      cacheRows,
      captureRows,
      quota: quotaQuery.data ?? null,
      probeHistory,
      selectedProbeId,
      onSelectProbe: setSelectedProbeId,
      onPushProbeEntry: pushProbeEntry,
      onBack: closeDetail,
      onJumpToScreenshot: jumpToScreenshot,
      onCaptureDeleted: handleCaptureDeleted,
      invalidateAll,
    }),
    [
      cacheRows,
      captureRows,
      closeDetail,
      handleCaptureDeleted,
      invalidateAll,
      jumpToScreenshot,
      probeHistory,
      pushProbeEntry,
      quotaQuery.data,
      selectedProbeId,
      source,
    ],
  )

  return (
    <AppPage>
      <EnrichmentHeader
        onSourceChange={switchSource}
        providers={providersQuery.data ?? null}
        source={source}
      />

      <EnrichmentRouteContext.Provider value={routeContextValue}>
        <MasterDetailShell
          emptyDetail={
            <DetailEmpty label={t('enrichment.detail.emptyCache')} />
          }
          onDismiss={closeDetail}
          list={
            <section className="flex h-full min-h-0 flex-col">
              {source === 'cache' ? (
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <FilterSegment
                    onChange={(next) => {
                      setFilterMode(next)
                      setCachePage(1)
                    }}
                    value={filterMode}
                  />
                  <Button
                    aria-label={t('common.refresh')}
                    disabled={cacheQuery.isFetching}
                    iconOnly
                    onClick={() => void cacheQuery.refetch()}
                    title={t('common.refresh')}
                    type="button"
                    variant="ghost"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={cn(
                        'size-4',
                        cacheQuery.isFetching && 'animate-spin',
                      )}
                    />
                  </Button>
                </div>
              ) : null}

              {source === 'screenshots' ? (
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
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
                    aria-label={t('common.refresh')}
                    disabled={captureQuery.isFetching}
                    iconOnly
                    onClick={() => {
                      void captureQuery.refetch()
                      void quotaQuery.refetch()
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={cn(
                        'size-4',
                        captureQuery.isFetching && 'animate-spin',
                      )}
                    />
                  </Button>
                </div>
              ) : null}

              {source === 'cache' ? (
                <CacheListPanel
                  filterMode={filterMode}
                  loading={cacheQuery.isLoading}
                  onPageChange={setCachePage}
                  onPageSizeChange={(size) => {
                    setCachePageSize(size)
                    setCachePage(1)
                  }}
                  onSelect={(row) => openCacheRow(row.id)}
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
                  onSelect={(row) => openCaptureRow(row.enrichmentId)}
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
                  }}
                  onSelect={(entry) => setSelectedProbeId(entry.id)}
                  selectedId={selectedProbeId}
                />
              ) : null}
            </section>
          }
        />
      </EnrichmentRouteContext.Provider>
    </AppPage>
  )
}
