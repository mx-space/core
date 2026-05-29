import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type {
  CreateMetaPresetDto,
  MetaFieldType,
  MetaPresetScope,
} from '~/models/meta-preset'
import type { KeyboardEvent } from 'react'

import {
  createMetaPreset,
  getMetaPresets,
  updateMetaPreset,
} from '~/api/meta-presets'
import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

import {
  fieldTypeOptionKeys,
  metaPresetsQueryKey,
  scopeOptionKeys,
  typesWithOptions,
} from '../../constants'
import {
  emptyMetaPreset,
  getErrorMessage,
  metaPresetToForm,
  validateMetaPreset,
} from '../../utils/settings'
import { FieldShell } from '../SettingsPrimitives'
import { ChildrenEditor } from './ChildrenEditor'
import { OptionsEditor } from './OptionsEditor'

interface MetaPresetModalProps {
  id?: string
}

function MetaPresetModal(props: MetaPresetModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const queryClient = useQueryClient()
  const fieldTypeOptions = useMemo(
    () =>
      fieldTypeOptionKeys.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )
  const scopeOptions = useMemo(
    () =>
      scopeOptionKeys.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )
  const presetsQuery = useQuery({
    enabled: Boolean(props.id),
    queryFn: async () => {
      const presets = await getMetaPresets()
      return presets.find((preset) => preset.id === props.id) ?? null
    },
    queryKey: [...metaPresetsQueryKey, props.id],
  })
  const [form, setForm] = useState<CreateMetaPresetDto>(emptyMetaPreset())

  useEffect(() => {
    if (props.id && presetsQuery.data) {
      setForm(metaPresetToForm(presetsQuery.data))
      return
    }
    if (!props.id) setForm(emptyMetaPreset())
  }, [props.id, presetsQuery.data])

  const mutation = useMutation({
    mutationFn: () =>
      props.id ? updateMetaPreset(props.id, form) : createMetaPreset(form),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(
          error,
          props.id
            ? t('settings.meta.error.update')
            : t('settings.meta.error.create'),
        ),
      ),
    onSuccess: async () => {
      toast.success(
        props.id
          ? t('settings.meta.success.update')
          : t('settings.meta.success.create'),
      )
      await queryClient.invalidateQueries({ queryKey: metaPresetsQueryKey })
      modal.close(true)
    },
  })

  const setField = <TKey extends keyof CreateMetaPresetDto>(
    key: TKey,
    value: CreateMetaPresetDto[TKey],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const submit = () => {
    const error = validateMetaPreset(t, form)
    if (error) {
      toast.error(error)
      return
    }
    mutation.mutate()
  }

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        title={
          props.id
            ? t('settings.meta.modal.edit')
            : t('settings.meta.modal.create')
        }
      />
      {presetsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-neutral-500">
          {t('settings.common.loading')}
        </div>
      ) : (
        <form
          className="space-y-4 px-5 py-4"
          onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label={t('settings.meta.field.key')}
              onChange={(value) => setField('key', value)}
              required
              value={form.key}
            />
            <TextInput
              label={t('settings.meta.field.label')}
              onChange={(value) => setField('label', value)}
              required
              value={form.label}
            />
            <FieldShell label={t('settings.meta.field.fieldType')}>
              <SelectField<MetaFieldType>
                aria-label={t('settings.meta.field.fieldType')}
                onValueChange={(value) => setField('type', value)}
                options={fieldTypeOptions}
                value={form.type}
              />
            </FieldShell>
            <FieldShell label={t('settings.meta.field.scope')}>
              <SelectField<MetaPresetScope>
                aria-label={t('settings.meta.scopeAria')}
                onValueChange={(value) => setField('scope', value)}
                options={scopeOptions}
                value={form.scope ?? 'both'}
              />
            </FieldShell>
          </div>
          <TextInput
            label={t('settings.meta.field.description')}
            onChange={(value) => setField('description', value)}
            value={form.description ?? ''}
          />
          <TextInput
            label={t('settings.meta.field.placeholder')}
            onChange={(value) => setField('placeholder', value)}
            value={form.placeholder ?? ''}
          />
          <Switch
            checked={Boolean(form.enabled ?? true)}
            label={t('settings.meta.switch.enabled')}
            onCheckedChange={(value) => setField('enabled', value)}
          />

          {typesWithOptions.includes(form.type) ? (
            <OptionsEditor
              onChange={(options) => setField('options', options)}
              options={form.options ?? []}
            />
          ) : null}

          {form.type === 'object' ? (
            <ChildrenEditor
              childrenFields={form.children ?? []}
              onChange={(children) => setField('children', children)}
            />
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => modal.dismiss()}
              type="button"
              variant="subtle"
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="size-4" />
              )}
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export function presentMetaPreset(id?: string) {
  return present<MetaPresetModalProps, boolean>(
    MetaPresetModal,
    { id },
    { modalProps: { popupStyle: { width: 'min(92vw, 40rem)' } } },
  )
}
