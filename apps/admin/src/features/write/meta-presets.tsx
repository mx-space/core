import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getMetaPresets } from '~/api/meta-presets'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import type {
  MetaFieldOption,
  MetaPresetChild,
  MetaPresetField,
  MetaPresetScope,
} from '~/models/meta-preset'
import { Modal, ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { CodeEditor } from '~/ui/primitives/code-editor'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextArea, TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

type MetaRecord = Record<string, unknown>

interface KeyValuePair {
  id: string
  key: string
  value: string
}

let pairIdSeq = 0
const nextPairId = () => `pair-${++pairIdSeq}`

function jsonStringifyValue(value: unknown) {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function jsonParseLoose(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function metaToPairs(meta: MetaRecord | undefined): KeyValuePair[] {
  if (!meta) return []
  return Object.entries(meta).map(([key, value]) => ({
    id: nextPairId(),
    key,
    value: jsonStringifyValue(value),
  }))
}

function pairsToMeta(pairs: KeyValuePair[]): MetaRecord {
  const next: MetaRecord = {}
  for (const pair of pairs) {
    if (!pair.key || pair.value === '') continue
    next[pair.key] = jsonParseLoose(pair.value)
  }
  return next
}

function metaPresetsQueryKey(scope: MetaPresetScope) {
  return ['meta-presets', { scope, enabledOnly: true }] as const
}

type BuiltinPresetTranslation = {
  children?: Record<
    string,
    { label: TranslationKey; placeholder?: TranslationKey }
  >
  description?: TranslationKey
  label: TranslationKey
  options?: Record<string, TranslationKey>
  placeholder?: TranslationKey
}

const builtinPresetTranslations: Record<string, BuiltinPresetTranslation> = {
  aiGen: {
    description: 'write.meta.builtin.aiGen.description',
    label: 'write.meta.builtin.aiGen.label',
    options: {
      '-1': 'write.meta.builtin.aiGen.option.noAi',
      '0': 'write.meta.builtin.aiGen.option.writingAssistance',
      '1': 'write.meta.builtin.aiGen.option.polishing',
      '2': 'write.meta.builtin.aiGen.option.fullyGenerated',
      '3': 'write.meta.builtin.aiGen.option.storyOrganization',
      '4': 'write.meta.builtin.aiGen.option.titleGeneration',
      '5': 'write.meta.builtin.aiGen.option.proofreading',
      '6': 'write.meta.builtin.aiGen.option.inspirationSource',
      '7': 'write.meta.builtin.aiGen.option.rewriting',
      '8': 'write.meta.builtin.aiGen.option.generatedImagery',
      '9': 'write.meta.builtin.aiGen.option.dictation',
    },
  },
  banner: {
    children: {
      className: {
        label: 'write.meta.builtin.banner.className.label',
        placeholder: 'write.meta.builtin.banner.className.placeholder',
      },
      message: { label: 'write.meta.builtin.banner.message.label' },
      type: { label: 'write.meta.builtin.banner.type.label' },
    },
    description: 'write.meta.builtin.banner.description',
    label: 'write.meta.builtin.banner.label',
  },
  cover: { label: 'write.meta.builtin.cover.label' },
  keywords: {
    label: 'write.meta.builtin.keywords.label',
    placeholder: 'write.meta.builtin.keywords.placeholder',
  },
  style: {
    label: 'write.meta.builtin.style.label',
    placeholder: 'write.meta.builtin.style.placeholder',
  },
}

function localizeBuiltinPreset(
  field: MetaPresetField,
  t: ReturnType<typeof useI18n>['t'],
): MetaPresetField {
  const translation = field.isBuiltin
    ? builtinPresetTranslations[field.key]
    : undefined
  if (!translation) return field

  return {
    ...field,
    children: field.children?.map((child) => {
      const childTranslation = translation.children?.[child.key]
      return childTranslation
        ? {
            ...child,
            label: t(childTranslation.label),
            placeholder: childTranslation.placeholder
              ? t(childTranslation.placeholder)
              : child.placeholder,
          }
        : child
    }),
    description: translation.description
      ? t(translation.description)
      : undefined,
    label: t(translation.label),
    options: field.options?.map((option) => {
      const optionKey = translation.options?.[String(option.value)]
      return optionKey ? { ...option, label: t(optionKey) } : option
    }),
    placeholder: translation.placeholder
      ? t(translation.placeholder)
      : field.placeholder,
  }
}

export interface MetaPresetSectionProps {
  meta: MetaRecord
  onUpdateMeta: (meta: MetaRecord) => void
  scope: MetaPresetScope
}

export function MetaPresetSection(props: MetaPresetSectionProps) {
  const { meta, onUpdateMeta, scope } = props
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'preset' | 'json'>('preset')
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  const presetsQuery = useQuery({
    queryFn: () => getMetaPresets({ enabledOnly: true, scope }),
    queryKey: metaPresetsQueryKey(scope),
    staleTime: 60_000,
  })

  const presets = useMemo<MetaPresetField[]>(
    () => (Array.isArray(presetsQuery.data) ? presetsQuery.data : []),
    [presetsQuery.data],
  )

  const itemCount = Object.keys(meta).length

  const updateFieldValue = (key: string, value: unknown) => {
    // Object field: an empty object represents "enabled but unfilled" state and must remain in meta.
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) {
      const { [key]: _drop, ...rest } = meta
      onUpdateMeta(rest)
    } else {
      onUpdateMeta({ ...meta, [key]: value })
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex w-full items-center gap-2 rounded border border-neutral-200 pr-2 dark:border-neutral-800">
        <button
          aria-expanded={expanded}
          className="flex flex-1 items-center justify-between rounded-l px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-900"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          <span>
            {t('write.meta.section.title')}
            {itemCount > 0 ? (
              <span className="ml-2 text-xs text-neutral-400">
                {t('write.meta.section.itemCount', { count: itemCount })}
              </span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 text-neutral-400 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </button>
        <button
          className="inline-flex h-7 shrink-0 items-center rounded px-2 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-shallow)]"
          onClick={() => setShowJsonModal(true)}
          type="button"
        >
          {t('write.meta.section.jsonEdit')}
        </button>
      </div>

      {expanded ? (
        <div className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="mb-3 inline-flex gap-1 rounded-sm border border-neutral-200 bg-neutral-50 p-0.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
            {(
              [
                ['preset', t('write.meta.tab.preset')],
                ['json', t('write.meta.tab.json')],
              ] as const
            ).map(([key, label]) => (
              <button
                className={cn(
                  'rounded-xs px-3 py-1 transition-colors',
                  activeTab === key
                    ? 'shadow-xs bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                )}
                key={key}
                onClick={() => setActiveTab(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'preset' ? (
            <PresetFieldList
              loading={presetsQuery.isLoading}
              meta={meta}
              onUpdateField={updateFieldValue}
              presets={presets}
            />
          ) : (
            <KeyValuePairList
              meta={meta}
              onUpdateMeta={onUpdateMeta}
              onTogglePreview={() => setShowJsonPreview((v) => !v)}
              previewOpen={showJsonPreview}
            />
          )}
        </div>
      ) : null}

      <JsonEditorDialog
        meta={meta}
        onClose={() => setShowJsonModal(false)}
        onSubmit={(next) => {
          onUpdateMeta(next)
          setShowJsonModal(false)
        }}
        open={showJsonModal}
      />
    </div>
  )
}

function PresetFieldList(props: {
  loading: boolean
  meta: MetaRecord
  onUpdateField: (key: string, value: unknown) => void
  presets: MetaPresetField[]
}) {
  const { t } = useI18n()
  if (props.loading) {
    return (
      <div className="space-y-2 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            className="h-8 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
            key={i}
          />
        ))}
      </div>
    )
  }
  if (props.presets.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-neutral-400">
        {t('write.meta.preset.empty')}
      </p>
    )
  }
  return (
    <div className="grid gap-4">
      {props.presets.map((field) => {
        const localizedField = localizeBuiltinPreset(field, t)
        return (
          <PresetFieldRenderer
            field={localizedField}
            key={field.id}
            onChange={(value) => props.onUpdateField(field.key, value)}
            value={props.meta[field.key]}
          />
        )
      })}
    </div>
  )
}

function PresetFieldRenderer(props: {
  field: MetaPresetField
  onChange: (value: unknown) => void
  value: unknown
}) {
  const { field, onChange, value } = props
  if (field.type === 'object') {
    return (
      <ObjectFieldRenderer field={field} onChange={onChange} value={value} />
    )
  }
  return (
    <div className="grid gap-1.5">
      <FieldLabel description={field.description} label={field.label} />
      <FieldControl field={field} onChange={onChange} value={value} />
    </div>
  )
}

function FieldLabel(props: { description?: string; label: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
        {props.label}
      </span>
      {props.description ? (
        <span className="text-xs text-neutral-400">{props.description}</span>
      ) : null}
    </div>
  )
}

function FieldControl(props: {
  field: MetaPresetField
  onChange: (value: unknown) => void
  value: unknown
}) {
  const { field, onChange, value } = props
  switch (field.type) {
    case 'text':
    case 'url': {
      return (
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          onChange={onChange}
          placeholder={
            field.placeholder || (field.type === 'url' ? 'https://...' : '')
          }
          value={typeof value === 'string' ? value : ''}
        />
      )
    }
    case 'textarea': {
      return (
        <TextArea
          controlClassName="min-h-20 focus:border-neutral-400"
          onChange={onChange}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
        />
      )
    }
    case 'number': {
      return (
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          inputMode="decimal"
          onChange={(v) => onChange(v === '' ? undefined : Number(v))}
          placeholder={field.placeholder}
          type="number"
          value={
            typeof value === 'number' || typeof value === 'string'
              ? String(value)
              : ''
          }
        />
      )
    }
    case 'boolean': {
      return (
        <Switch
          checked={value === true}
          label={field.label}
          onCheckedChange={onChange}
        />
      )
    }
    case 'select': {
      const options = field.options ?? []
      return (
        <SelectField
          onValueChange={onChange as (v: string) => void}
          options={options.map((o) => ({
            label: o.label,
            value: String(o.value),
          }))}
          value={value == null ? '' : String(value)}
        />
      )
    }
    case 'multi-select': {
      return (
        <MultiSelectField
          allowCustom={false}
          field={field}
          onChange={onChange}
          value={value}
        />
      )
    }
    case 'checkbox': {
      return (
        <MultiSelectField
          allowCustom={Boolean(field.allowCustomOption)}
          field={field}
          onChange={onChange}
          value={value}
        />
      )
    }
    case 'tags': {
      return <TagsInput onChange={onChange} value={normalizeToArray(value)} />
    }
    default: {
      return (
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          onChange={onChange}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
        />
      )
    }
  }
}

function ObjectFieldRenderer(props: {
  field: MetaPresetField
  onChange: (value: MetaRecord | undefined) => void
  value: unknown
}) {
  const isEnabled = props.value !== undefined && props.value !== null
  const current =
    isEnabled && typeof props.value === 'object' && !Array.isArray(props.value)
      ? (props.value as MetaRecord)
      : {}

  const toggle = (enabled: boolean) => {
    props.onChange(enabled ? {} : undefined)
  }

  const updateChild = (key: string, childValue: unknown) => {
    const isEmpty = childValue == null || childValue === ''
    if (isEmpty) {
      const { [key]: _drop, ...rest } = current
      props.onChange(rest)
    } else {
      props.onChange({ ...current, [key]: childValue })
    }
  }

  return (
    <div className="grid gap-2">
      <Switch
        checked={isEnabled}
        description={props.field.description}
        label={props.field.label}
        onCheckedChange={toggle}
      />
      {isEnabled && props.field.children ? (
        <div className="ml-3 grid gap-3 border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
          {props.field.children.map((child) => (
            <ChildFieldRenderer
              child={child}
              key={child.key}
              onChange={(v) => updateChild(child.key, v)}
              value={current[child.key]}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ChildFieldRenderer(props: {
  child: MetaPresetChild
  onChange: (value: unknown) => void
  value: unknown
}) {
  const { child, onChange, value } = props
  const control = () => {
    switch (child.type) {
      case 'textarea': {
        return (
          <TextArea
            controlClassName="min-h-16 focus:border-neutral-400"
            onChange={onChange}
            placeholder={child.placeholder}
            value={typeof value === 'string' ? value : ''}
          />
        )
      }
      case 'number': {
        return (
          <TextInput
            controlClassName="h-9 focus:border-neutral-400"
            inputMode="decimal"
            onChange={(v) => onChange(v === '' ? undefined : Number(v))}
            placeholder={child.placeholder}
            type="number"
            value={
              typeof value === 'number' || typeof value === 'string'
                ? String(value)
                : ''
            }
          />
        )
      }
      case 'select': {
        const options = child.options ?? []
        return (
          <SelectField
            onValueChange={onChange as (v: string) => void}
            options={options.map((o) => ({
              label: o.label,
              value: String(o.value),
            }))}
            value={value == null ? '' : String(value)}
          />
        )
      }
      default: {
        return (
          <TextInput
            controlClassName="h-9 focus:border-neutral-400"
            onChange={onChange}
            placeholder={child.placeholder}
            value={typeof value === 'string' ? value : ''}
          />
        )
      }
    }
  }

  return (
    <div className="grid gap-1">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {child.label}
      </span>
      {control()}
    </div>
  )
}

function MultiSelectField(props: {
  allowCustom: boolean
  field: MetaPresetField
  onChange: (value: unknown) => void
  value: unknown
}) {
  const { t } = useI18n()
  const options = props.field.options ?? []
  const optionValueSet = useMemo(
    () => new Set(options.map((o) => o.value)),
    [options],
  )
  const exclusiveValues = useMemo(
    () => new Set(options.filter((o) => o.exclusive).map((o) => o.value)),
    [options],
  )

  const all = normalizeToArray(props.value)
  const customs = all.filter(
    (v) => typeof v === 'string' && !optionValueSet.has(v),
  ) as string[]
  const [customInput, setCustomInput] = useState('')

  const isChecked = (option: MetaFieldOption) => all.includes(option.value)

  const toggleOption = (option: MetaFieldOption, checked: boolean) => {
    let next = all.filter((v) => v !== option.value)
    if (checked) {
      if (option.exclusive) {
        next = [option.value]
      } else {
        next = next.filter((v) => !exclusiveValues.has(v))
        next.push(option.value)
      }
    }
    props.onChange(normalizeFromArray(next))
  }

  const addCustom = () => {
    const trimmed = customInput.trim()
    if (!trimmed || all.includes(trimmed)) {
      setCustomInput('')
      return
    }
    const next = all.filter((v) => !exclusiveValues.has(v))
    next.push(trimmed)
    setCustomInput('')
    props.onChange(normalizeFromArray(next))
  }

  const removeCustom = (val: string) => {
    const next = all.filter((v) => v !== val)
    props.onChange(normalizeFromArray(next))
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((option) => (
          <Checkbox
            checked={isChecked(option)}
            key={String(option.value)}
            label={option.label}
            onCheckedChange={(checked) => toggleOption(option, checked)}
          />
        ))}
      </div>
      {customs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {customs.map((val) => (
            <span
              className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              key={val}
            >
              {val}
              <button
                aria-label={t('write.meta.multiSelect.removeAria', {
                  value: val,
                })}
                className="rounded p-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                onClick={() => removeCustom(val)}
                type="button"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {props.allowCustom ? (
        <div className="flex gap-2">
          <TextInput
            controlClassName="h-8 focus:border-neutral-400"
            onChange={setCustomInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addCustom()
              }
            }}
            placeholder={t('write.meta.multiSelect.customPlaceholder')}
            value={customInput}
          />
          <Button
            className="h-8 px-2"
            disabled={!customInput.trim()}
            onClick={addCustom}
            type="button"
            variant="subtle"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function TagsInput(props: {
  onChange: (value: unknown) => void
  value: unknown[]
}) {
  const { t } = useI18n()
  const tags = props.value.map((v) => String(v))
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (!trimmed || tags.includes(trimmed)) {
      setInput('')
      return
    }
    const next = [...tags, trimmed]
    setInput('')
    props.onChange(next)
  }

  const remove = (tag: string) => {
    props.onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="grid gap-2">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              key={tag}
            >
              {tag}
              <button
                aria-label={t('write.meta.multiSelect.removeAria', {
                  value: tag,
                })}
                className="rounded p-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                onClick={() => remove(tag)}
                type="button"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <TextInput
          controlClassName="h-8 focus:border-neutral-400"
          onChange={setInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          placeholder={t('write.meta.tags.placeholder')}
          value={input}
        />
        <Button
          className="h-8 px-2"
          disabled={!input.trim()}
          onClick={add}
          type="button"
          variant="subtle"
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function KeyValuePairList(props: {
  meta: MetaRecord
  onTogglePreview: () => void
  onUpdateMeta: (meta: MetaRecord) => void
  previewOpen: boolean
}) {
  const { t } = useI18n()
  const [pairs, setPairs] = useState<KeyValuePair[]>(() =>
    metaToPairs(props.meta),
  )

  useEffect(() => {
    setPairs(metaToPairs(props.meta))
  }, [props.meta])

  const commit = (next: KeyValuePair[]) => {
    setPairs(next)
    props.onUpdateMeta(pairsToMeta(next))
  }

  const updatePair = (id: string, patch: Partial<KeyValuePair>) => {
    commit(pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const removePair = (id: string) => {
    commit(pairs.filter((p) => p.id !== id))
  }

  const addPair = () => {
    commit([...pairs, { id: nextPairId(), key: '', value: '' }])
  }

  const hasMeta = Object.keys(props.meta).length > 0

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {pairs.length === 0 ? (
          <p className="py-2 text-center text-xs text-neutral-400">
            {t('write.meta.kvList.empty')}
          </p>
        ) : (
          pairs.map((pair) => (
            <div className="flex items-center gap-2" key={pair.id}>
              <TextInput
                controlClassName="h-8 focus:border-neutral-400"
                onChange={(value) => updatePair(pair.id, { key: value })}
                placeholder={t('write.meta.kvList.keyPlaceholder')}
                value={pair.key}
              />
              <TextInput
                controlClassName="h-8 focus:border-neutral-400"
                onChange={(value) => updatePair(pair.id, { value })}
                placeholder={t('write.meta.kvList.valuePlaceholder')}
                value={pair.value}
              />
              <button
                aria-label={t('write.meta.kvList.deleteFieldAria')}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                onClick={() => removePair(pair.id)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))
        )}
        <Button onClick={addPair} type="button" variant="subtle">
          <Plus aria-hidden="true" className="size-4" />
          {t('write.meta.kvList.addField')}
        </Button>
      </div>

      {hasMeta ? (
        <div className="rounded border border-neutral-200 dark:border-neutral-800">
          <button
            aria-expanded={props.previewOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
            onClick={props.onTogglePreview}
            type="button"
          >
            <span>{t('write.meta.kvList.previewJson')}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 text-neutral-400 transition-transform',
                props.previewOpen && 'rotate-180',
              )}
            />
          </button>
          {props.previewOpen ? (
            <Scroll className="max-h-48" viewportClassName="max-h-48">
              <pre className="overflow-auto px-3 pb-3 font-mono text-xs leading-5 text-neutral-700 dark:text-neutral-300">
                {JSON.stringify(props.meta, null, 2)}
              </pre>
            </Scroll>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function JsonEditorDialog(props: {
  meta: MetaRecord
  onClose: () => void
  onSubmit: (meta: MetaRecord) => void
  open: boolean
}) {
  const { t } = useI18n()
  const initial = useMemo(
    () =>
      Object.keys(props.meta).length > 0
        ? JSON.stringify(props.meta, null, 2)
        : '',
    [props.meta, props.open],
  )
  const [value, setValue] = useState(initial)

  useEffect(() => {
    if (props.open) setValue(initial)
  }, [props.open, initial])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      props.onSubmit({})
      return
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast.error(t('write.meta.json.invalidObject'))
        return
      }
      props.onSubmit(parsed as MetaRecord)
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : t('write.meta.json.parseError'),
      )
    }
  }

  return (
    <Modal
      onClose={props.onClose}
      open={props.open}
      popupStyle={{ height: 'min(80vh, 40rem)', width: 'min(92vw, 56rem)' }}
    >
      <ModalHeader title={t('write.meta.json.dialogTitle')} />
      <div className="min-h-0 flex-1">
        <CodeEditor
          language="json"
          onChange={setValue}
          onSave={submit}
          title="META JSON"
          value={value}
        />
      </div>
      <ModalFooter>
        <Button onClick={props.onClose} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button onClick={submit} type="button">
          {t('common.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function normalizeToArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value
  return [value]
}

function normalizeFromArray(arr: unknown[]): unknown {
  if (arr.length === 0) return undefined
  if (arr.length === 1) return arr[0]
  return arr
}
