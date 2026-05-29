import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Camera,
  Globe,
  Loader2,
  Mail,
  Plus,
  Save,
  Shield,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { UpdateOwnerData } from '~/api/options'

import { uploadFile } from '~/api/files'
import { getOwner, updateOwner } from '~/api/options'
import { IpInfoPopover } from '~/features/_shared/components/ip-info-popover'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { TextArea, TextInput } from '~/ui/primitives/text-field'

import { settingsQueryKey, socialOptions } from '../constants'
import { formatDateTime, getErrorMessage } from '../utils/settings'
import { SettingsSection, SettingsSkeleton } from './SettingsPrimitives'

export function OwnerSettings(props: { onSaved: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [form, setForm] = useState<UpdateOwnerData>({})
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const socialLabel = (key: string) => {
    const option = socialOptions.find((item) => item.value === key)
    if (!option) return key
    return option.labelKey ? t(option.labelKey) : (option.label ?? key)
  }

  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: [...settingsQueryKey, 'owner'],
  })

  useEffect(() => {
    setForm({
      avatar: ownerQuery.data?.avatar,
      introduce: ownerQuery.data?.introduce,
      mail: ownerQuery.data?.mail,
      name: ownerQuery.data?.name,
      socialIds: ownerQuery.data?.socialIds,
      url: ownerQuery.data?.url,
      username: ownerQuery.data?.username,
    })
  }, [ownerQuery.data])

  const mutation = useMutation({
    mutationFn: () => updateOwner(form),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.owner.error.save'))),
    onSuccess: async () => {
      toast.success(t('settings.owner.success.save'))
      await props.onSaved()
    },
  })
  const avatarUploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'avatar'),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.owner.error.avatarUpload')),
      ),
    onSuccess: (result) => {
      setForm((current) => ({ ...current, avatar: result.url }))
      toast.success(t('settings.owner.success.avatarUpload'))
    },
  })

  const socialEntries = Object.entries(form.socialIds ?? {})
  const usedSocialKeys = new Set(socialEntries.map(([key]) => key))
  const availableSocialOption = socialOptions.find(
    (option) => !usedSocialKeys.has(option.value),
  )

  const setField = (key: keyof UpdateOwnerData, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateSocial = (oldKey: string, nextKey: string, value: string) => {
    if (oldKey !== nextKey && Object.hasOwn(form.socialIds ?? {}, nextKey)) {
      toast.warning(t('settings.owner.confirm.duplicateSocial'))
      return
    }

    setForm((current) => {
      const next = { ...current.socialIds }
      if (oldKey !== nextKey) delete next[oldKey]
      next[nextKey] = value
      return { ...current, socialIds: next }
    })
  }

  const removeSocial = (key: string) => {
    setForm((current) => {
      const next = { ...current.socialIds }
      delete next[key]
      return { ...current, socialIds: next }
    })
  }

  const addSocial = () => {
    if (!availableSocialOption) return
    updateSocial(`custom-${Date.now()}`, availableSocialOption.value, '')
  }

  if (ownerQuery.isLoading)
    return <SettingsSkeleton title={t('settings.owner.section.title')} />

  return (
    <SettingsSection
      description={t('settings.owner.description')}
      title={t('settings.owner.section.title')}
    >
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <input
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) avatarUploadMutation.mutate(file)
            }}
            ref={avatarInputRef}
            type="file"
          />
          <button
            className="group relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-lg font-semibold text-neutral-500 ring-4 ring-neutral-100 transition-all hover:ring-[var(--color-primary-shallow)] dark:bg-neutral-900 dark:ring-neutral-800"
            onClick={() => avatarInputRef.current?.click()}
            title={t('settings.owner.upload.avatarTooltip')}
            type="button"
          >
            {form.avatar ? (
              <img
                alt=""
                className="size-full object-cover"
                src={form.avatar}
              />
            ) : (
              form.name?.slice(0, 1) || form.username?.slice(0, 1) || 'U'
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              {avatarUploadMutation.isPending ? (
                <Loader2
                  aria-hidden="true"
                  className="size-5 animate-spin text-white"
                />
              ) : (
                <Camera aria-hidden="true" className="size-5 text-white" />
              )}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-neutral-950 dark:text-neutral-50">
              {form.name || t('settings.owner.nameDefault')}
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              @{form.username || t('settings.owner.usernameDefault')}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              {form.mail ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-neutral-400"
                  />
                  <span className="truncate">{form.mail}</span>
                </span>
              ) : null}
              {ownerQuery.data?.lastLoginTime ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Shield
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-neutral-400"
                  />
                  <span>
                    {t('settings.owner.lastLoginAt', {
                      time: formatDateTime(ownerQuery.data.lastLoginTime),
                    })}
                  </span>
                </span>
              ) : null}
              {ownerQuery.data?.lastLoginIp ? (
                <IpInfoPopover
                  className="inline-flex min-w-0 items-center gap-1.5 hover:underline"
                  ip={ownerQuery.data.lastLoginIp}
                  trigger={
                    <>
                      <Globe
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-neutral-400"
                      />
                      <span>{ownerQuery.data.lastLoginIp}</span>
                    </>
                  }
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label={t('settings.owner.field.name')}
            onChange={(value) => setField('name', value)}
            value={form.name ?? ''}
          />
          <TextInput
            label={t('settings.owner.field.username')}
            onChange={(value) => setField('username', value)}
            value={form.username ?? ''}
          />
          <TextInput
            label={t('settings.owner.field.email')}
            onChange={(value) => setField('mail', value)}
            type="email"
            value={form.mail ?? ''}
          />
          <TextInput
            label={t('settings.owner.field.url')}
            onChange={(value) => setField('url', value)}
            value={form.url ?? ''}
          />
        </div>

        <TextInput
          label={t('settings.owner.field.avatar')}
          onChange={(value) => setField('avatar', value)}
          value={form.avatar ?? ''}
        />
        <TextArea
          controlClassName="min-h-24"
          label={t('settings.owner.field.introduce')}
          onChange={(value) => setField('introduce', value)}
          value={form.introduce ?? ''}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {t('settings.owner.social.title')}
            </h3>
            <Button
              disabled={!availableSocialOption}
              onClick={addSocial}
              type="button"
              variant="subtle"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t('settings.owner.social.add')}
            </Button>
          </div>
          <div className="space-y-2">
            {socialEntries.length === 0 ? (
              <p className="text-sm text-neutral-500">
                {t('settings.owner.social.empty')}
              </p>
            ) : (
              socialEntries.map(([key, value]) => (
                <div
                  className="grid gap-2 md:grid-cols-[12rem_1fr_auto]"
                  key={key}
                >
                  {socialOptions.some((option) => option.value === key) ? (
                    <SelectField
                      aria-label={t('settings.owner.field.socialAria')}
                      onValueChange={(nextKey) =>
                        updateSocial(key, nextKey, String(value))
                      }
                      options={socialOptions
                        .filter(
                          (option) =>
                            option.value === key ||
                            !usedSocialKeys.has(option.value),
                        )
                        .map((option) => ({
                          label: socialLabel(option.value),
                          value: option.value,
                        }))}
                      value={key}
                    />
                  ) : (
                    <TextInput
                      aria-label={undefined}
                      onChange={(nextKey) =>
                        updateSocial(key, nextKey, String(value))
                      }
                      value={key}
                    />
                  )}
                  <TextInput
                    onChange={(nextValue) => updateSocial(key, key, nextValue)}
                    value={String(value)}
                  />
                  <Button
                    onClick={() => removeSocial(key)}
                    type="button"
                    variant="subtle"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  )
}
