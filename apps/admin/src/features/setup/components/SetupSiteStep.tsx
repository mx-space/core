import { X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { InitDefaultConfigs } from '~/api/system'
import type { FormEvent } from 'react'
import type { SetupUrls } from '../types/setup'

import { patchInitConfig } from '~/api/system'
import { useI18n } from '~/i18n'
import { TextInput } from '~/ui/primitives/text-field'

import { inputClassName, labelClassName } from '../constants'
import { getErrorMessage } from '../utils/setup'
import { StepActions, UrlInput } from './SetupPrimitives'

export function SetupSiteStep(props: {
  defaultConfigs: InitDefaultConfigs
  onNext: () => void
  onPrev: () => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(props.defaultConfigs.seo?.title ?? '')
  const [description, setDescription] = useState(
    props.defaultConfigs.seo?.description ?? '',
  )
  const [keywords, setKeywords] = useState<string[]>(
    props.defaultConfigs.seo?.keywords ?? [],
  )
  const [keywordInput, setKeywordInput] = useState('')
  const [urls, setUrls] = useState<SetupUrls>({
    adminUrl: `${location.origin}/qaqdmin`,
    serverUrl: `${location.origin}/api/v2`,
    webUrl: location.origin,
    wsUrl: location.origin,
  })
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = Boolean(title && description)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)

    try {
      await Promise.all([
        patchInitConfig('seo', {
          description,
          keywords,
          title,
        }),
        patchInitConfig('url', urls),
      ])
      props.onNext()
    } catch (error) {
      toast.error(getErrorMessage(error, t('setup.site.saveError')))
    } finally {
      setSubmitting(false)
    }
  }

  const addKeyword = () => {
    const value = keywordInput.trim()
    if (!value || keywords.includes(value)) return
    setKeywords((current) => [...current, value])
    setKeywordInput('')
  }

  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
      <form onSubmit={submit}>
        <div className="space-y-4">
          <TextInput
            autoComplete="organization"
            controlClassName={inputClassName}
            label={t('setup.site.titleLabel')}
            labelClassName={labelClassName}
            onChange={setTitle}
            placeholder={t('setup.site.titlePlaceholder')}
            required
            value={title}
          />

          <TextInput
            autoComplete="off"
            controlClassName={inputClassName}
            label={t('setup.site.descriptionLabel')}
            labelClassName={labelClassName}
            onChange={setDescription}
            placeholder={t('setup.site.descriptionPlaceholder')}
            required
            value={description}
          />

          <div>
            <label className={labelClassName}>
              {t('setup.site.keywordsLabel')}
            </label>
            <div className="rounded-2xl bg-white/10 p-2">
              <div className="mb-2 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs text-white"
                    key={keyword}
                  >
                    {keyword}
                    <button
                      aria-label={t('setup.site.keywordRemoveLabel', {
                        keyword,
                      })}
                      onClick={() =>
                        setKeywords((current) =>
                          current.filter((item) => item !== keyword),
                        )
                      }
                      type="button"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <TextInput
                controlClassName="h-9 rounded-full border-0 bg-white/10 px-3 text-sm text-white placeholder:text-white/50 focus:bg-white/20 dark:border-0 dark:bg-white/10 dark:text-white"
                onChange={setKeywordInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addKeyword()
                  }
                }}
                placeholder={t('setup.site.keywordPlaceholder')}
                value={keywordInput}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <UrlInput
              label={t('setup.site.webUrlLabel')}
              onChange={(value) =>
                setUrls((current) => ({ ...current, webUrl: value }))
              }
              value={urls.webUrl}
            />
            <UrlInput
              label={t('setup.site.apiUrlLabel')}
              onChange={(value) =>
                setUrls((current) => ({ ...current, serverUrl: value }))
              }
              value={urls.serverUrl}
            />
            <UrlInput
              label={t('setup.site.adminUrlLabel')}
              onChange={(value) =>
                setUrls((current) => ({ ...current, adminUrl: value }))
              }
              value={urls.adminUrl}
            />
            <UrlInput
              label={t('setup.site.gatewayUrlLabel')}
              onChange={(value) =>
                setUrls((current) => ({ ...current, wsUrl: value }))
              }
              value={urls.wsUrl}
            />
          </div>
        </div>

        <StepActions
          canSubmit={canSubmit}
          onPrev={props.onPrev}
          submitting={submitting}
        />
      </form>
    </div>
  )
}
