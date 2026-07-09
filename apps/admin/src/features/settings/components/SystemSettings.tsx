import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Mail } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { sendTestEmail } from '~/api/health'
import type { ConfigFormGroup, ConfigFormSchema } from '~/api/options'
import { getAllOptions, patchOption } from '~/api/options'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'

import { settingsQueryKey } from '../constants'
import {
  cloneJson,
  getErrorMessage,
  isDeepEqual,
  normalizeAIConfig,
  setPathImmutable,
} from '../utils/settings'
import { AIConfigEditor } from './ai/AIConfigEditor'
import { ConfigSectionFields } from './config/ConfigSectionFields'
import { presentTestAiReview } from './modals/TestAiReviewModal'
import { SeoConfigEditor } from './seo/SeoConfigEditor'
import { useSettingsActionBarSetter } from './SettingsActionBar'
import { SettingsSection, SettingsSkeleton } from './SettingsPrimitives'

export function SystemSettings(props: {
  activeGroup: ConfigFormGroup
  schema?: ConfigFormSchema
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const setDirtyAction = useSettingsActionBarSetter()
  const [configs, setConfigs] = useState<Record<string, unknown>>({})
  const [origin, setOrigin] = useState<Record<string, unknown>>({})

  const optionsQuery = useQuery({
    enabled: Boolean(props.schema),
    queryFn: getAllOptions,
    queryKey: adminQueryKeys.settings.options(),
  })

  useEffect(() => {
    if (!optionsQuery.data) return
    setConfigs(cloneJson(optionsQuery.data))
    setOrigin(cloneJson(optionsQuery.data))
  }, [optionsQuery.data])

  const dirtySections = useMemo(() => {
    const keys = new Set([...Object.keys(origin), ...Object.keys(configs)])
    return [...keys].filter((key) => !isDeepEqual(origin[key], configs[key]))
  }, [configs, origin])

  const saveAllMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        dirtySections.map((sectionKey) =>
          patchOption(sectionKey, configs[sectionKey] ?? {}),
        ),
      ),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.common.error.savedFailed')),
      ),
    onSuccess: async () => {
      toast.success(
        t('settings.common.savedAll', { count: dirtySections.length }),
      )
      await queryClient.invalidateQueries({ queryKey: settingsQueryKey })
    },
  })

  const testEmailMutation = useMutation({
    mutationFn: sendTestEmail,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.common.error.sendTestEmailFailed')),
      ),
    onSuccess: (result) => {
      if (result.message)
        toast.error(
          t('settings.system.section.testEmailFailed', {
            message: result.message,
          }),
        )
      else toast.success(t('settings.system.section.testEmailSent'))
    },
  })

  const updateValue = (path: string, value: unknown) => {
    setConfigs((current) => setPathImmutable(current, path, value))
  }

  const handleFieldAction = useCallback(
    (actionId: string) => {
      if (actionId === 'test-ai-review') void presentTestAiReview()
      else
        toast.warning(
          t('settings.common.section.unknownAction', { action: actionId }),
        )
    },
    [t],
  )

  const discardChanges = useCallback(() => {
    setConfigs(cloneJson(origin))
  }, [origin])

  const hasDirty = dirtySections.length > 0
  const dirtyCount = dirtySections.length
  const saving = saveAllMutation.isPending
  const saveMutate = saveAllMutation.mutate

  useEffect(() => {
    if (!hasDirty) {
      setDirtyAction(null)
      return
    }
    setDirtyAction({
      count: dirtyCount,
      onDiscard: discardChanges,
      onSaveAll: () => saveMutate(),
      saving,
    })
    return () => setDirtyAction(null)
  }, [hasDirty, dirtyCount, saving, saveMutate, discardChanges, setDirtyAction])

  if (optionsQuery.isLoading)
    return <SettingsSkeleton title={props.activeGroup.title} />

  return (
    <div className="space-y-10">
      {props.activeGroup.sections
        .filter((section) => !section.hidden)
        .map((section) => (
          <SettingsSection
            actions={
              section.key === 'mailOptions' ? (
                <Button
                  disabled={testEmailMutation.isPending}
                  onClick={() => testEmailMutation.mutate()}
                  type="button"
                  variant="subtle"
                >
                  {testEmailMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Mail aria-hidden="true" className="size-4" />
                  )}
                  {t('settings.system.section.sendTestEmail')}
                </Button>
              ) : null
            }
            description={section.description}
            dirty={dirtySections.includes(section.key)}
            key={section.key}
            title={section.title}
          >
            {section.key === 'ai' ? (
              <AIConfigEditor
                modelCacheKey={adminQueryKeys.settings.aiModels()}
                onChange={(value) => updateValue(section.key, value)}
                value={normalizeAIConfig(configs[section.key])}
              />
            ) : section.key === 'seo' ? (
              <SeoConfigEditor
                fields={section.fields}
                formData={configs}
                onAction={handleFieldAction}
                prefix={section.key}
                updateValue={updateValue}
              />
            ) : (
              <ConfigSectionFields
                fields={section.fields}
                formData={configs}
                onAction={handleFieldAction}
                prefix={section.key}
                updateValue={updateValue}
              />
            )}
          </SettingsSection>
        ))}
    </div>
  )
}
