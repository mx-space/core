import { Bookmark, BookOpen, EyeOff, Heart, MapPin } from 'lucide-react'

import { WEB_URL } from '~/constants/env'
import {
  ContentEntryListItem,
  ContentListStatusBadge,
} from '~/features/_shared/components/content-list-item'
import { useI18n } from '~/i18n'
import type { NoteModel } from '~/models/note'
import type { ListAction } from '~/ui/list-actions'
import { relativeTimeFromNow } from '~/utils/time'

import type { NoteMetadataUpdate } from '../types/notes'
import { buildNotePublicPath, formatCompactNumber } from '../utils/format'
import { buildNoteMenuItems } from './buildNoteMenuItems'

export function NoteRow(props: {
  actions: ReadonlyArray<ListAction<NoteModel>>
  cursor?: boolean
  note: NoteModel
  onMetadataChange: (id: string, data: NoteMetadataUpdate) => void
  onPublishChange: (id: string, isPublished: boolean) => void
  onSelect: (id: string, mode: 'single' | 'toggle' | 'range') => void
  onSelectedChange: (checked: boolean) => void
  selected: boolean
}) {
  const { t } = useI18n()
  const note = props.note
  const isFuture = note.publicAt && +new Date(note.publicAt) - Date.now() > 0
  const publicHref = `${WEB_URL}${buildNotePublicPath(note)}`
  const title = note.title || t('notes.row.untitled')
  const editPath = `/notes/edit?id=${encodeURIComponent(note.id)}`

  const menuItems = () =>
    buildNoteMenuItems(note, {
      actions: props.actions,
      externalHref: publicHref,
      onBookmarkToggle: (next) =>
        props.onMetadataChange(note.id, { bookmark: next }),
      onMoodChange: (next) => props.onMetadataChange(note.id, { mood: next }),
      onPublishToggle: (next) => props.onPublishChange(note.id, next),
      onWeatherChange: (next) =>
        props.onMetadataChange(note.id, { weather: next }),
      t,
    })

  return (
    <ContentEntryListItem
      checkboxLabel={t('notes.list.checkboxAria', { title })}
      cursor={props.cursor}
      dataId={note.id}
      editTitle={t('notes.action.editNote')}
      editTo={editPath}
      externalHref={publicHref}
      leading={
        <>
          <span className="shrink-0 font-mono text-xs text-fg-subtle">
            #{note.nid}
          </span>
          {!note.isPublished || isFuture ? (
            <EyeOff
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-muted"
            />
          ) : null}
          {note.bookmark ? (
            <Bookmark
              aria-hidden="true"
              className="size-3.5 text-red-500"
              fill="currentColor"
            />
          ) : null}
        </>
      }
      menuItems={menuItems}
      meta={
        <>
          <span className="font-mono text-xs text-fg-subtle">
            {note.slug || '-'}
          </span>
          {note.mood ? (
            <span>{t('notes.row.meta.mood', { value: note.mood })}</span>
          ) : null}
          {note.weather ? (
            <span>{t('notes.row.meta.weather', { value: note.weather })}</span>
          ) : null}
          {note.location ? (
            <span className="inline-flex max-w-40 items-center gap-1 truncate">
              <MapPin aria-hidden="true" className="size-3" />
              {note.location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <BookOpen aria-hidden="true" className="size-3" />
            {formatCompactNumber(note.readCount ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart aria-hidden="true" className="size-3" />
            {formatCompactNumber(note.likeCount ?? 0)}
          </span>
        </>
      }
      onSelect={(mode) => props.onSelect(note.id, mode)}
      onSelectedChange={props.onSelectedChange}
      openTitle={t('notes.action.openNote')}
      selected={props.selected}
      status={
        <ContentListStatusBadge active={Boolean(note.isPublished && !isFuture)}>
          {!note.isPublished
            ? t('notes.status.draft')
            : isFuture
              ? t('notes.status.scheduled')
              : t('notes.status.published')}
        </ContentListStatusBadge>
      }
      title={title}
      titleTo={editPath}
      trailingFooter={
        <time dateTime={note.createdAt}>
          {relativeTimeFromNow(note.createdAt)}
        </time>
      }
    />
  )
}
