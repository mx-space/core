import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CreateMetaPresetDto } from '~/models/meta-preset'

import {
  deleteMetaPreset,
  getMetaPresets,
  updateMetaPreset,
  updateMetaPresetOrder,
} from '~/api/meta-presets'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { metaPresetsQueryKey } from '../../constants'
import { getErrorMessage } from '../../utils/settings'
import { EmptyState, SettingsSection } from '../SettingsPrimitives'
import { presentMetaPreset } from './MetaPresetModal'
import { MetaPresetRow } from './MetaPresetRow'

export function MetaPresetSettings() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const presetsQuery = useQuery({
    queryFn: () => getMetaPresets(),
    queryKey: metaPresetsQueryKey,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      data: Partial<CreateMetaPresetDto>
      id: string
    }) => updateMetaPreset(id, data),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.meta.error.update'))),
    onSuccess: async () => {
      toast.success(t('settings.meta.success.update'))
      await queryClient.invalidateQueries({ queryKey: metaPresetsQueryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMetaPreset,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.meta.error.delete'))),
    onSuccess: async () => {
      toast.success(t('settings.meta.success.delete'))
      await queryClient.invalidateQueries({ queryKey: metaPresetsQueryKey })
    },
  })

  const orderMutation = useMutation({
    mutationFn: updateMetaPresetOrder,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.meta.error.orderSave'))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: metaPresetsQueryKey })
    },
  })

  const presets = presetsQuery.data ?? []

  const dropPreset = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return
    const items = [...presets]
    const [item] = items.splice(draggedIndex, 1)
    items.splice(dropIndex, 0, item)
    setDraggedIndex(null)
    orderMutation.mutate(items.map((preset) => preset.id))
  }

  return (
    <SettingsSection
      actions={
        <Button
          onClick={() => {
            void presentMetaPreset()
          }}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('settings.meta.action.addPreset')}
        </Button>
      }
      description={t('settings.meta.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <ListPlus aria-hidden="true" className="size-4" />
          {t('settings.meta.title')}
        </span>
      }
    >
      {presetsQuery.isLoading ? (
        <div className="py-3 text-sm text-neutral-500">
          {t('settings.common.loading')}
        </div>
      ) : presets.length === 0 ? (
        <EmptyState
          icon={<ListPlus className="size-7" />}
          label={t('settings.meta.empty')}
        />
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {presets.map((preset, index) => (
            <div
              className={cn(
                'transition-opacity',
                draggedIndex === index && 'opacity-50',
              )}
              draggable={!preset.isBuiltin}
              key={preset.id}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedIndex(index)}
              onDrop={(event) => {
                event.preventDefault()
                dropPreset(index)
              }}
            >
              <MetaPresetRow
                onDelete={(id) => {
                  if (
                    window.confirm(
                      t('settings.meta.confirm.delete', {
                        label: preset.label,
                      }),
                    )
                  ) {
                    deleteMutation.mutate(id)
                  }
                }}
                onEdit={(id) => {
                  void presentMetaPreset(id)
                }}
                onToggle={(item) =>
                  updateMutation.mutate({
                    data: { enabled: !item.enabled },
                    id: item.id,
                  })
                }
                preset={preset}
              />
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  )
}
