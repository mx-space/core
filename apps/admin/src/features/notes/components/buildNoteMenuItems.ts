import { CloudSun, Copy, Smile } from 'lucide-react'
import { toast } from 'sonner'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { NoteModel } from '~/models/note'
import type { ListAction } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

import { presentNoteMetaEditModal } from './NoteMetaEditModal'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export interface BuildNoteMenuItemsOptions {
  actions: ReadonlyArray<ListAction<NoteModel>>
  externalHref: string
  onBookmarkToggle: (next: boolean) => void
  onMoodChange: (next: string | null) => void
  onPublishToggle: (next: boolean) => void
  onWeatherChange: (next: string | null) => void
  t: Translator
}

async function copyText(
  value: string | undefined | null,
  label: string,
  t: Translator,
) {
  const str = value == null ? '' : String(value)
  if (!str) {
    toast.error(t('notes.toast.copyTargetMissing', { label }))
    return
  }
  try {
    await navigator.clipboard.writeText(str)
    toast.success(t('notes.toast.copySucceeded', { label }))
  } catch {
    toast.error(t('notes.toast.copyFailed'))
  }
}

function actionToItem<T>(
  action: ListAction<T> | undefined,
  target: T,
): ContextMenuItem | null {
  if (!action) return null
  if (action.available && !action.available([target])) return null
  return {
    danger: action.danger,
    extra: action.shortcutLabel,
    icon: action.icon,
    key: action.key,
    label: action.label,
    onClick: () => void action.run([target]),
  }
}

export function buildNoteMenuItems(
  note: NoteModel,
  options: BuildNoteMenuItemsOptions,
): ContextMenuItem[] {
  const find = (key: string) =>
    options.actions.find((action) => action.key === key)
  const t = options.t
  const items: ContextMenuItem[] = []

  const edit = actionToItem(find('edit'), note)
  if (edit) items.push(edit)
  const openExternal = actionToItem(find('open-external'), note)
  if (openExternal) items.push(openExternal)

  items.push(
    { key: 'sep-1', type: 'divider' },
    {
      checked: note.isPublished,
      key: 'publish',
      label: t('notes.menu.publish'),
      onCheckedChange: options.onPublishToggle,
      type: 'checkbox',
    },
    {
      checked: note.bookmark,
      key: 'bookmark',
      label: t('notes.menu.bookmark'),
      onCheckedChange: options.onBookmarkToggle,
      type: 'checkbox',
    },
    { key: 'sep-2', type: 'divider' },
    {
      icon: Smile,
      key: 'mood',
      label: t('notes.menu.mood.change'),
      onClick: async () => {
        const next = await presentNoteMetaEditModal({
          initialValue: note.mood ?? '',
          label: t('notes.menu.mood.label'),
          placeholder: t('notes.menu.mood.placeholder'),
          title: t('notes.menu.mood.change'),
        })
        if (next === undefined) return
        options.onMoodChange(next)
      },
    },
    {
      icon: CloudSun,
      key: 'weather',
      label: t('notes.menu.weather.change'),
      onClick: async () => {
        const next = await presentNoteMetaEditModal({
          initialValue: note.weather ?? '',
          label: t('notes.menu.weather.label'),
          placeholder: t('notes.menu.weather.placeholder'),
          title: t('notes.menu.weather.change'),
        })
        if (next === undefined) return
        options.onWeatherChange(next)
      },
    },
    { key: 'sep-3', type: 'divider' },
    {
      icon: Copy,
      key: 'copy-link',
      label: t('notes.menu.copy.link'),
      onClick: () =>
        void copyText(options.externalHref, t('notes.copy.label.link'), t),
    },
    {
      key: 'copy-id',
      label: t('notes.menu.copy.id'),
      onClick: () => void copyText(note.id, t('notes.copy.label.id'), t),
    },
    {
      key: 'copy-nid',
      label: t('notes.menu.copy.nid'),
      onClick: () =>
        void copyText(`#${note.nid}`, t('notes.copy.label.nid'), t),
    },
  )

  const remove = actionToItem(find('delete'), note)
  if (remove) {
    items.push({ key: 'sep-4', type: 'divider' }, remove)
  }

  return items
}
