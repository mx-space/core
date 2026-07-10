import {
  AtSign,
  Bold,
  Command,
  CornerDownLeft,
  Loader2,
  Send,
} from 'lucide-react'
import type { FormEvent, KeyboardEvent, Ref } from 'react'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextArea } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { EmojiPopover } from './CommentPrimitives'

export interface ReplyComposerHandle {
  focus: () => void
}

interface ThreadParticipant {
  name: string
}

interface ReplyComposerProps {
  onSubmit: (text: string) => Promise<unknown> | void
  pending: boolean
  ownerName: string
  threadParticipants?: ReadonlyArray<ThreadParticipant>
  handleRef?: Ref<ReplyComposerHandle>
}

export function ReplyComposer(props: ReplyComposerProps) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mentionAnchorRef = useRef<number>(-1)

  useImperativeHandle(props.handleRef, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const filteredParticipants = (props.threadParticipants ?? []).filter(
    (participant) => {
      if (!mentionQuery) return true
      return participant.name
        .toLowerCase()
        .startsWith(mentionQuery.toLowerCase())
    },
  )

  useEffect(() => {
    if (!mentionOpen) return
    if (mentionIndex >= filteredParticipants.length) {
      setMentionIndex(Math.max(0, filteredParticipants.length - 1))
    }
  }, [mentionOpen, mentionIndex, filteredParticipants.length])

  const submit = async () => {
    const trimmed = value.trim()
    if (!trimmed || props.pending) return
    await props.onSubmit(trimmed)
    setValue('')
    closeMention()
  }

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await submit()
  }

  const closeMention = () => {
    setMentionOpen(false)
    setMentionQuery('')
    mentionAnchorRef.current = -1
  }

  const detectMentionAt = (input: HTMLTextAreaElement, nextValue: string) => {
    const cursor = input.selectionStart
    if (cursor == null) return
    const slice = nextValue.slice(0, cursor)
    const atIndex = slice.lastIndexOf('@')
    if (atIndex < 0) {
      closeMention()
      return
    }
    const charBefore = atIndex === 0 ? ' ' : slice[atIndex - 1]
    if (!/\s/.test(charBefore)) {
      closeMention()
      return
    }
    const query = slice.slice(atIndex + 1)
    if (/\s/.test(query)) {
      closeMention()
      return
    }
    mentionAnchorRef.current = atIndex
    setMentionQuery(query)
    setMentionOpen(true)
    setMentionIndex(0)
  }

  const handleChange = (next: string) => {
    setValue(next)
    const input = textareaRef.current
    if (input) {
      window.requestAnimationFrame(() => detectMentionAt(input, next))
    }
  }

  const insertEmoji = (emoji: string) => {
    const input = textareaRef.current
    if (!input) {
      setValue((current) => `${current}${emoji}`)
      return
    }
    const start = input.selectionStart
    const end = input.selectionEnd
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`
    setValue(next)
    window.requestAnimationFrame(() => {
      input.focus()
      const cursor = start + emoji.length
      input.setSelectionRange(cursor, cursor)
    })
  }

  const wrapSelectionWithBold = () => {
    const input = textareaRef.current
    if (!input) return false
    const start = input.selectionStart
    const end = input.selectionEnd
    if (start === end) return false
    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const after = value.slice(end)
    const next = `${before}**${selected}**${after}`
    setValue(next)
    window.requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + 2, end + 2)
    })
    return true
  }

  const selectMention = (name: string) => {
    const input = textareaRef.current
    if (!input || mentionAnchorRef.current < 0) {
      closeMention()
      return
    }
    const anchor = mentionAnchorRef.current
    const cursor = input.selectionStart ?? value.length
    const before = value.slice(0, anchor)
    const after = value.slice(cursor)
    const insert = `@${name} `
    const next = `${before}${insert}${after}`
    setValue(next)
    const nextCursor = before.length + insert.length
    window.requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(nextCursor, nextCursor)
    })
    closeMention()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredParticipants.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMentionIndex((idx) => (idx + 1) % filteredParticipants.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMentionIndex(
          (idx) =>
            (idx - 1 + filteredParticipants.length) %
            filteredParticipants.length,
        )
        return
      }
      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        selectMention(filteredParticipants[mentionIndex].name)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMention()
        return
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
      return
    }
    if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === 'b' || event.key === 'B')
    ) {
      if (wrapSelectionWithBold()) {
        event.preventDefault()
      }
      return
    }
    if (event.key === 'Escape') {
      setValue('')
      textareaRef.current?.blur()
    }
  }

  const canSend = !!value.trim() && !props.pending

  return (
    <form className="relative px-4 py-3" onSubmit={handleFormSubmit}>
      <TextArea
        controlClassName={cn(
          'min-h-16 resize-none border-0 bg-transparent px-0 py-1 shadow-none',
          'placeholder:text-fg-subtle/80 focus:border-transparent focus:ring-0 focus-visible:ring-0',
          'dark:border-0',
        )}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('comments.reply.placeholder')}
        ref={textareaRef}
        value={value}
      />

      <div className="mt-1 flex items-center gap-2">
        <EmojiPopover onSelect={insertEmoji} />
        <span className="flex-1" />
        <span
          aria-label={t('comments.reply.shortcutHint')}
          className="hidden items-center gap-1.5 text-fg-subtle sm:inline-flex"
        >
          <AtSign aria-hidden="true" className="size-3" />
          <span aria-hidden="true" className="text-fg-subtle/50">
            ·
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Command aria-hidden="true" className="size-3" />
            <Bold aria-hidden="true" className="size-3" />
          </span>
          <span aria-hidden="true" className="text-fg-subtle/50">
            ·
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Command aria-hidden="true" className="size-3" />
            <CornerDownLeft aria-hidden="true" className="size-3" />
          </span>
        </span>
        <Button
          className="h-8 gap-1.5 px-2.5"
          disabled={!canSend}
          type="submit"
          variant="ghost"
        >
          {props.pending ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="size-3.5" />
          )}
          <span className="text-[12px]">{t('comments.reply.submit')}</span>
        </Button>
      </div>

      {mentionOpen && filteredParticipants.length > 0 ? (
        <ul
          aria-label={t('comments.reply.mentionLabel')}
          className="shadow-md absolute bottom-full left-4 z-10 mb-2 w-56 overflow-hidden rounded-md border border-border bg-surface-overlay py-1"
          role="listbox"
        >
          {filteredParticipants.map((participant, idx) => (
            <li
              aria-selected={idx === mentionIndex}
              className={cn(
                'cursor-default px-3 py-1.5 text-sm text-fg',
                idx === mentionIndex && 'bg-accent-soft text-accent',
              )}
              key={participant.name}
              onMouseDown={(event) => {
                event.preventDefault()
                selectMention(participant.name)
              }}
              role="option"
            >
              {participant.name}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}
