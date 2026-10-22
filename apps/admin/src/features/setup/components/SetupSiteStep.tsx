import { X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { InitDefaultConfigs } from '~/api/system'
import { patchInitConfig } from '~/api/system'
import { useI18n } from '~/i18n'
import { TextInput } from '~/ui/primitives/text-field'

import type { SetupUrls } from '../types/setup'
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
    <form onSubmit={submit}>
      <div className="space-y-4">
        <TextInput
          autoComplete="organization"
          label={t('setup.site.titleLabel')}
          onChange={setTitle}
          placeholder={t('setup.site.titlePlaceholder')}
          required
          value={title}
        />

        <TextInput
          autoComplete="off"
          label={t('setup.site.descriptionLabel')}
          onChange={setDescription}
          placeholder={t('setup.site.descriptionPlaceholder')}
          required
          value={description}
        />

        <div className="grid gap-1.5 text-sm">
          <TextInput
            label={t('setup.site.keywordsLabel')}
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
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent"
                  key={keyword}
                >
                  {keyword}
                  <button
                    aria-label={t('setup.site.keywordRemoveLabel', {
                      keyword,
                    })}
                    className="rounded-full transition-colors hover:text-accent-hover"
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
          ) : null}
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
  )
}
