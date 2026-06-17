import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getSnippets } from '~/api/snippets'
import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import { Popover } from '~/ui/overlay/popover'
import { Combobox } from '~/ui/primitives/combobox'
import { MarkdownRender } from '~/ui/primitives/markdown-render'

interface SkillPickerProps {
  value: string[]
  onChange: (next: string[]) => void
}

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---.*?\n---\s*\n/s)
  return match ? raw.slice(match[0].length) : raw
}

function previewSlice(raw: string, max = 1200): string {
  const body = stripFrontmatter(raw).trimStart()
  if (body.length <= max) return body
  const cut = body.slice(0, max)
  const lastBreak = cut.lastIndexOf('\n\n')
  return `${lastBreak > max * 0.6 ? cut.slice(0, lastBreak) : cut}\n\n…`
}

interface SkillPillProps {
  skill: SnippetModel
  removeLabel: string
  onRemove: () => void
}

function SkillPill({ skill, removeLabel, onRemove }: SkillPillProps) {
  const preview = useMemo(() => previewSlice(skill.raw), [skill.raw])
  return (
    <Popover>
      <Popover.Trigger
        closeDelay={120}
        delay={200}
        nativeButton={false}
        openOnHover
        render={(triggerProps) => (
          <span
            {...triggerProps}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent"
          >
            {skill.name}
            <button
              aria-label={removeLabel}
              className="inline-flex h-3 w-3 items-center justify-center rounded-full text-accent/70 hover:text-accent"
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              type="button"
            >
              <X size={12} />
            </button>
          </span>
        )}
      />
      <Popover.Content
        align="start"
        className="flex max-h-[28rem] flex-col overflow-hidden"
        side="left"
        sideOffset={8}
        width="lg"
      >
        <Popover.Header>
          <span className="font-mono normal-case tracking-normal text-fg">
            {skill.name}
          </span>
        </Popover.Header>
        <Popover.Body className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {skill.comment ? (
            <p className="text-xs leading-relaxed text-fg-muted">
              {skill.comment}
            </p>
          ) : null}
          <MarkdownRender text={preview} />
        </Popover.Body>
      </Popover.Content>
    </Popover>
  )
}

export function SkillPicker({ value, onChange }: SkillPickerProps) {
  const { t } = useI18n()
  const [inputValue, setInputValue] = useState('')

  const skillsQuery = useQuery({
    queryFn: () => getSnippets({ type: SnippetType.Skill, size: 100 }),
    queryKey: ['snippets', 'skills'],
    staleTime: 60_000,
    select: (res: any) => {
      if (Array.isArray(res)) return res as SnippetModel[]
      if (Array.isArray(res?.data)) return res.data as SnippetModel[]
      return [] as SnippetModel[]
    },
  })

  const skillMap = useMemo(() => {
    const map = new Map<string, SnippetModel>()
    for (const skill of skillsQuery.data ?? []) {
      map.set(skill.id, skill)
    }
    return map
  }, [skillsQuery.data])

  const availableItems = useMemo(
    () => (skillsQuery.data ?? []).filter((s) => !value.includes(s.id)),
    [skillsQuery.data, value],
  )

  const handleSelect = (selected: unknown) => {
    if (!selected || typeof selected !== 'object') return
    const { value: id } = selected as { value: string }
    if (!id || !skillMap.has(id)) return
    onChange([...value, id])
    setInputValue('')
  }

  const remove = (id: string) => onChange(value.filter((v) => v !== id))

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const skill = skillMap.get(id)
            if (skillsQuery.isLoading) {
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-surface-inset px-2 py-0.5 font-mono text-xs text-fg-subtle"
                  key={id}
                >
                  <span className="animate-pulse">…</span>
                  <button
                    aria-label={t('write.section.skill.removeAria', {
                      name: id,
                    })}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-full text-fg-subtle/70 hover:text-fg-subtle"
                    onClick={() => remove(id)}
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </span>
              )
            }
            return skill ? (
              <SkillPill
                key={id}
                onRemove={() => remove(id)}
                removeLabel={t('write.section.skill.removeAria', {
                  name: skill.name,
                })}
                skill={skill}
              />
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-fg-subtle"
                key={id}
                title={t('write.section.skill.unavailable')}
              >
                {id}
                <button
                  aria-label={t('write.section.skill.removeAria', { name: id })}
                  className="inline-flex h-3 w-3 items-center justify-center rounded-full text-fg-subtle/70 hover:text-fg-subtle"
                  onClick={() => remove(id)}
                  type="button"
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <Combobox
        inputValue={inputValue}
        items={availableItems.map((s) => ({ value: s.id, label: s.name }))}
        onInputValueChange={setInputValue}
        onValueChange={handleSelect}
        value={null}
      >
        <Combobox.Control>
          <Combobox.Input placeholder={t('write.section.skill.placeholder')} />
          <Combobox.Trigger aria-label={t('write.section.skill.placeholder')}>
            {skillsQuery.isLoading ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : undefined}
          </Combobox.Trigger>
        </Combobox.Control>
        <Combobox.Content>
          <Combobox.Empty>
            {skillsQuery.isLoading
              ? t('write.section.skill.loading')
              : t('write.section.skill.empty')}
          </Combobox.Empty>
          <Combobox.List>
            {(item: { value: string; label: string }) => {
              const skill = skillMap.get(item.value)
              return (
                <Combobox.Item key={item.value} value={item}>
                  <span className="font-mono">{item.label}</span>
                  {skill?.comment ? (
                    <span className="ml-2 truncate text-xs text-fg-muted">
                      {skill.comment}
                    </span>
                  ) : null}
                </Combobox.Item>
              )
            }}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>

      <p className="text-xs text-fg-muted">{t('write.section.skill.helper')}</p>
    </div>
  )
}
