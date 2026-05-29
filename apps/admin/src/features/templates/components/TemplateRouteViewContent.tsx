import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { sendTestEmail } from '~/api/health'
import {
  deleteEmailTemplate,
  getEmailTemplate,
  updateEmailTemplate,
} from '~/api/options'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'

import {
  DEFAULT_VIEW_MODE,
  templateDescriptors,
  templateQueryKey,
  VIEW_MODE_STORAGE_KEY,
  VIEW_MODES,
} from '../constants'
import { flattenPropsKeys } from '../lib/ejs-monaco'
import { renderEjsTemplate } from '../lib/ejs-render'
import {
  mergeFallbackProps,
  templateFallbackProps,
} from '../lib/fallback-props'
import type { TemplateType, TemplateViewMode } from '../types/templates'
import { getErrorMessage } from '../utils/errors'
import { TemplateDetailPane } from './TemplateDetailPane'
import { TemplateListPane } from './TemplateListPane'
import { TemplatesRouteContext } from './templates-route-context'

function isTemplateType(value: unknown): value is TemplateType {
  return value === 'guest' || value === 'owner' || value === 'newsletter'
}

function isViewMode(value: unknown): value is TemplateViewMode {
  return VIEW_MODES.includes(value as TemplateViewMode)
}

function readInitialViewMode(): TemplateViewMode {
  if (typeof window === 'undefined') return DEFAULT_VIEW_MODE
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
  return isViewMode(stored) ? stored : DEFAULT_VIEW_MODE
}

export function TemplateRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const pathType: TemplateType | null = isTemplateType(params.id)
    ? params.id
    : null
  // For data/state hooks always use a concrete type; default to the first
  // descriptor so the query has something stable to fetch.
  const type: TemplateType = pathType ?? templateDescriptors[0].value

  const [source, setSource] = useState('')
  const [propsValue, setPropsValue] = useState<unknown>({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [viewMode, setViewMode] =
    useState<TemplateViewMode>(readInitialViewMode)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
  }, [viewMode])

  const templateQuery = useQuery({
    queryFn: () => getEmailTemplate(type),
    queryKey: adminQueryKeys.templates.email(type),
  })
  const savedSource = templateQuery.data?.template ?? ''
  const defaultProps = useMemo(
    () =>
      mergeFallbackProps(
        templateFallbackProps[type],
        templateQuery.data?.props,
      ),
    [templateQuery.data?.props, type],
  )
  const isDirty = source !== savedSource

  useEffect(() => {
    if (templateQuery.data?.template !== undefined) {
      setSource(templateQuery.data.template)
    }
  }, [templateQuery.data?.template])

  useEffect(() => {
    setPropsValue(defaultProps)
  }, [defaultProps])

  useEffect(() => {
    let cancelled = false
    setPreviewError('')

    if (!source) {
      setPreviewHtml('')
      return
    }

    renderEjsTemplate(source, propsValue)
      .then((html) => {
        if (cancelled) return
        setPreviewHtml(html)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPreviewError(getErrorMessage(error, t('templates.renderError')))
      })

    return () => {
      cancelled = true
    }
  }, [propsValue, source, t])

  const propsKeys = useMemo(() => flattenPropsKeys(propsValue), [propsValue])

  const invalidateTemplate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.templates.email(type),
    })
  }, [queryClient, type])

  const saveMutation = useMutation({
    mutationFn: () => updateEmailTemplate(type, source),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('templates.saveFailed'))),
    onSuccess: async () => {
      toast.success(t('templates.saveSuccess'))
      await invalidateTemplate()
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => deleteEmailTemplate(type),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('templates.resetFailed'))),
    onSuccess: async () => {
      toast.success(t('templates.resetSuccess'))
      await invalidateTemplate()
    },
  })

  const testEmailMutation = useMutation({
    mutationFn: () => sendTestEmail(),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('templates.testSmtp.failed'))),
    onSuccess: (response) => {
      if (response && (response.message || response.trace)) {
        toast.error(response.message || t('templates.testSmtp.failed'))
        return
      }
      toast.success(t('templates.testSmtp.success'))
    },
  })

  const requestReset = useCallback(async () => {
    const confirmed = await confirmDialog({
      title: t('templates.resetDialog.title'),
      description: t('templates.resetDialog.description'),
      confirmText: t('templates.reset'),
      destructive: true,
    })
    if (confirmed) resetMutation.mutate()
  }, [resetMutation, t])

  const handleSelect = useCallback(
    (next: TemplateType) => {
      navigate(`/assets/template/${next}`)
    },
    [navigate],
  )

  const ctxValue = useMemo(
    () => ({
      defaultProps,
      dirty: isDirty,
      loading: templateQuery.isLoading,
      onChangeProps: setPropsValue,
      onChangeSource: setSource,
      onChangeView: setViewMode,
      onRefresh: () => void templateQuery.refetch(),
      onReset: () => void requestReset(),
      onSave: () => saveMutation.mutate(),
      onTestSmtp: () => testEmailMutation.mutate(),
      previewError,
      previewHtml,
      propsKeys,
      propsValue,
      refreshing: templateQuery.isFetching && !templateQuery.isLoading,
      resetting: resetMutation.isPending,
      saving: saveMutation.isPending,
      source,
      testing: testEmailMutation.isPending,
      type,
      viewMode,
    }),
    [
      defaultProps,
      isDirty,
      previewError,
      previewHtml,
      propsKeys,
      propsValue,
      requestReset,
      resetMutation.isPending,
      saveMutation,
      saveMutation.isPending,
      source,
      templateQuery,
      testEmailMutation,
      type,
      viewMode,
    ],
  )

  return (
    <TemplatesRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        defaultSize={220}
        emptyDetail={
          <TemplateDetailPane
            defaultProps={defaultProps}
            dirty={isDirty}
            loading={templateQuery.isLoading}
            onChangeProps={setPropsValue}
            onChangeSource={setSource}
            onChangeView={setViewMode}
            onRefresh={() => void templateQuery.refetch()}
            onReset={() => void requestReset()}
            onSave={() => saveMutation.mutate()}
            onTestSmtp={() => testEmailMutation.mutate()}
            previewError={previewError}
            previewHtml={previewHtml}
            propsKeys={propsKeys}
            propsValue={propsValue}
            refreshing={templateQuery.isFetching && !templateQuery.isLoading}
            resetting={resetMutation.isPending}
            saving={saveMutation.isPending}
            source={source}
            testing={testEmailMutation.isPending}
            type={type}
            viewMode={viewMode}
          />
        }
        list={
          <TemplateListPane
            dirtyType={isDirty ? type : null}
            onSelect={handleSelect}
            selected={type}
          />
        }
        maxSize={320}
        minSize={180}
      />
    </TemplatesRouteContext.Provider>
  )
}
