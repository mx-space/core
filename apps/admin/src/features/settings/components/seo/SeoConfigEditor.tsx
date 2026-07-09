import type { ReactNode } from 'react'
import { useState } from 'react'

import type { ConfigFormField } from '~/api/options'
import { useI18n } from '~/i18n'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { TextArea, TextInput } from '~/ui/primitives/text-field'

import type { SeoI18nOverlay } from '../../types/settings'
import { getPath } from '../../utils/settings'
import { ConfigSectionFields } from '../config/ConfigSectionFields'
import { TagsEditor } from '../TagsEditor'

type SeoTab = 'base' | 'en'

function readEnOverlay(
  formData: Record<string, unknown>,
  prefix: string,
): SeoI18nOverlay {
  const i18n = getPath(formData, `${prefix}.i18n`)
  const en =
    i18n && typeof i18n === 'object'
      ? (i18n as Record<string, unknown>).en
      : undefined
  if (!en || typeof en !== 'object') return {}

  const { title, description, keywords } = en as SeoI18nOverlay
  return {
    description: typeof description === 'string' ? description : undefined,
    keywords: Array.isArray(keywords) ? keywords.map(String) : undefined,
    title: typeof title === 'string' ? title : undefined,
  }
}

export function SeoConfigEditor(props: {
  fields: ConfigFormField[]
  formData: Record<string, unknown>
  onAction: (actionId: string) => void
  prefix: string
  updateValue: (path: string, value: unknown) => void
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState<SeoTab>('base')
  const enOverlay = readEnOverlay(props.formData, props.prefix)

  const commitEnOverlay = (nextEn: SeoI18nOverlay) => {
    const i18n = getPath(props.formData, `${props.prefix}.i18n`)
    const rest =
      i18n && typeof i18n === 'object' ? (i18n as Record<string, unknown>) : {}

    const definedEnEntries = Object.entries(nextEn).filter(
      ([, value]) => value !== undefined,
    )

    const next: Record<string, unknown> =
      definedEnEntries.length > 0
        ? { ...rest, en: Object.fromEntries(definedEnEntries) }
        : Object.fromEntries(
            Object.entries(rest).filter(([key]) => key !== 'en'),
          )

    props.updateValue(`${props.prefix}.i18n`, next)
  }

  const updateEnTitle = (value: string) => {
    const next = { ...enOverlay }
    if (value.trim()) next.title = value
    else delete next.title
    commitEnOverlay(next)
  }

  const updateEnDescription = (value: string) => {
    const next = { ...enOverlay }
    if (value.trim()) next.description = value
    else delete next.description
    commitEnOverlay(next)
  }

  const updateEnKeywords = (value: string[]) => {
    const next = { ...enOverlay }
    if (value.length > 0) next.keywords = value
    else delete next.keywords
    commitEnOverlay(next)
  }

  return (
    <div className="space-y-5">
      <SegmentedControl<SeoTab>
        aria-label={t('settings.seo.tab.ariaLabel')}
        onValueChange={setTab}
        options={[
          { label: t('settings.seo.tab.base'), value: 'base' },
          { label: t('settings.seo.tab.en'), value: 'en' },
        ]}
        value={tab}
      />

      {tab === 'base' ? (
        <ConfigSectionFields
          fields={props.fields}
          formData={props.formData}
          onAction={props.onAction}
          prefix={props.prefix}
          updateValue={props.updateValue}
        />
      ) : (
        <div className="space-y-5">
          <SeoI18nFieldRow
            description={t('settings.seo.i18n.hint')}
            title={t('settings.seo.i18n.field.title')}
          >
            <TextInput onChange={updateEnTitle} value={enOverlay.title ?? ''} />
          </SeoI18nFieldRow>
          <SeoI18nFieldRow
            description={t('settings.seo.i18n.hint')}
            title={t('settings.seo.i18n.field.description')}
          >
            <TextArea
              controlClassName="min-h-24"
              onChange={updateEnDescription}
              value={enOverlay.description ?? ''}
            />
          </SeoI18nFieldRow>
          <SeoI18nFieldRow
            description={t('settings.seo.i18n.hint')}
            title={t('settings.seo.i18n.field.keywords')}
          >
            <TagsEditor
              onChange={updateEnKeywords}
              value={enOverlay.keywords ?? []}
            />
          </SeoI18nFieldRow>
        </div>
      )}
    </div>
  )
}

function SeoI18nFieldRow(props: {
  children: ReactNode
  description?: string
  title: string
}) {
  return (
    <div className="grid items-start gap-x-8 gap-y-2 md:grid-cols-2">
      <div className="min-w-0 md:pt-1.5">
        <div className="text-sm text-neutral-800 dark:text-neutral-200">
          {props.title}
        </div>
        {props.description ? (
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {props.description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{props.children}</div>
    </div>
  )
}
