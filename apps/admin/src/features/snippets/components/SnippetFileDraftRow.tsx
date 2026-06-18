import type { LucideIcon } from 'lucide-react'
import {
  Code,
  FileCode,
  FileJson,
  FileText,
  FunctionSquare,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useI18n } from '~/i18n'
import { SnippetType } from '~/models/snippet'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

const typeIconMap: Record<SnippetType, LucideIcon> = {
  [SnippetType.JSON]: FileJson,
  [SnippetType.JSON5]: Code,
  [SnippetType.Function]: FunctionSquare,
  [SnippetType.Skill]: FileText,
  [SnippetType.Text]: FileText,
  [SnippetType.YAML]: FileCode,
}

const typeIconColorMap: Record<SnippetType, string> = {
  [SnippetType.JSON]: 'text-orange-500',
  [SnippetType.JSON5]: 'text-purple-500',
  [SnippetType.Function]: 'text-blue-500',
  [SnippetType.Skill]: 'text-teal-500',
  [SnippetType.Text]: 'text-neutral-500',
  [SnippetType.YAML]: 'text-red-500',
}

interface SnippetFileDraftRowProps {
  level: number
  name: string
  type: SnippetType
  onChange: (name: string) => void
  onCommit: () => void
  onCancel: () => void
}

export function SnippetFileDraftRow(props: SnippetFileDraftRowProps) {
  const { t } = useI18n()
  const Icon = typeIconMap[props.type] ?? FileText
  const iconColor = typeIconColorMap[props.type] ?? 'text-neutral-500'
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    const firstDot = el.value.indexOf('.')
    const end = firstDot <= 0 ? el.value.length : firstDot
    el.setSelectionRange(0, end)
  }, [])

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    props.onCommit()
  }

  return (
    <div
      aria-level={props.level + 1}
      className="flex h-8 w-full items-center gap-1.5 px-2"
      role="treeitem"
    >
      {props.level > 0 ? (
        <span
          aria-hidden="true"
          className="shrink-0"
          style={{ width: 25 + props.level * 14 }}
        />
      ) : (
        <span aria-hidden="true" className="w-[25px] shrink-0" />
      )}
      <Icon aria-hidden="true" className={cn('size-3 shrink-0', iconColor)} />
      <TextInput
        aria-label={t('snippets.list.newFile')}
        autoComplete="off"
        controlClassName="h-7 min-w-0 flex-1 px-1.5 text-sm focus:border-neutral-400 focus:ring-0"
        onBlur={commit}
        onChange={props.onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            committedRef.current = true
            props.onCancel()
          }
        }}
        ref={inputRef}
        spellCheck={false}
        value={props.name}
      />
    </div>
  )
}
