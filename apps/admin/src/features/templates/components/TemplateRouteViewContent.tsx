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

import { templateDescriptors } from '../constants'
import { flattenPropsKeys } from '../lib/ejs-monaco'
import { renderEjsTemplate } from '../lib/ejs-render'
import {
  mergeFallbackProps,
  templateFallbackProps,
} from '../lib/fallback-props'
import type { TemplateType } from '../types/templates'
import { getErrorMessage } from '../utils/errors'
import { TemplateDetailRoute } from './TemplateDetailRoute'
import { TemplatesRouteContext } from './templates-route-context'

function isTemplateType(value: unknown): value is TemplateType {
  return value === 'guest' || value === 'owner' || value === 'newsletter'
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
      onRefresh: () => void templateQuery.refetch(),
      onReset: () => void requestReset(),
      onSave: () => saveMutation.mutate(),
      onSelect: handleSelect,
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
    }),
    [
      defaultProps,
      handleSelect,
      isDirty,
      previewError,
      previewHtml,
      propsKeys,
      propsValue,
      requestReset,
      resetMutation.isPending,
      saveMutation.isPending,
      source,
      templateQuery,
      testEmailMutation.isPending,
      type,
    ],
  )

  return (
    <TemplatesRouteContext.Provider value={ctxValue}>
      <TemplateDetailRoute />
    </TemplatesRouteContext.Provider>
  )
}
