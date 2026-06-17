import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getSnippets } from '~/api/snippets'
import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import { Combobox } from '~/ui/primitives/combobox'

interface SkillPickerProps {
  value: string[]
  onChange: (next: string[]) => void
}

export function SkillPicker({ value, onChange }: SkillPickerProps) {
  const { t } = useI18n()
  const [inputValue, setInputValue] = useState('')

  const skillsQuery = useQuery({
    queryFn: () => getSnippets({ type: SnippetType.Skill, size: 200 }),
    queryKey: ['snippets', 'skills'],
    staleTime: 60_000,
    select: (res: any) =>
      (Array.isArray(res?.data) ? res.data : []) as SnippetModel[],
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

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const skill = skillMap.get(id)
            return skill ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent"
                key={id}
              >
                {skill.name}
                <button
                  aria-label={t('write.section.skill.removeAria', {
                    name: skill.name,
                  })}
                  className="inline-flex h-3 w-3 items-center justify-center rounded-full text-accent/70 hover:text-accent"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  type="button"
                >
                  <X size={12} />
                </button>
              </span>
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
                  onClick={() => onChange(value.filter((v) => v !== id))}
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
