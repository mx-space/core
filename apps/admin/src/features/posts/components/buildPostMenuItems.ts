import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { PostModel } from '~/models/post'
import type { ListAction } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

export interface PostMenuCategoryOption {
  id: string
  name: string
}

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export interface BuildPostMenuItemsOptions {
  actions: ReadonlyArray<ListAction<PostModel>>
  categories: PostMenuCategoryOption[]
  externalHref: string
  onCategoryChange: (categoryId: string) => void
  onPinToggle: (next: boolean) => void
  onPublishToggle: (next: boolean) => void
  t: Translator
}

async function copyText(
  value: string | undefined,
  label: string,
  t: Translator,
) {
  if (!value) {
    toast.error(t('posts.toast.copyTargetMissing', { label }))
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    toast.success(t('posts.toast.copySucceeded', { label }))
  } catch {
    toast.error(t('posts.toast.copyFailed'))
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

export function buildPostMenuItems(
  post: PostModel,
  options: BuildPostMenuItemsOptions,
): ContextMenuItem[] {
  const find = (key: string) =>
    options.actions.find((action) => action.key === key)

  const t = options.t

  const items: ContextMenuItem[] = []

  const edit = actionToItem(find('edit'), post)
  if (edit) items.push(edit)
  const openExternal = actionToItem(find('open-external'), post)
  if (openExternal) items.push(openExternal)

  items.push(
    { key: 'sep-1', type: 'divider' },
    {
      checked: post.isPublished ?? false,
      key: 'publish',
      label: t('posts.menu.publish'),
      onCheckedChange: options.onPublishToggle,
      type: 'checkbox',
    },
    {
      checked: Boolean(post.pinAt),
      key: 'pin',
      label: t('posts.menu.pin'),
      onCheckedChange: options.onPinToggle,
      type: 'checkbox',
    },
  )

  if (options.categories.length > 0) {
    items.push({
      children: options.categories.map<ContextMenuItem>((category) => ({
        icon: category.id === post.categoryId ? Check : undefined,
        key: `category-${category.id}`,
        label: category.name,
        onClick: () => options.onCategoryChange(category.id),
      })),
      key: 'category-submenu',
      label: t('posts.menu.category.change'),
      type: 'submenu',
    })
  }

  items.push(
    { key: 'sep-2', type: 'divider' },
    {
      icon: Copy,
      key: 'copy-link',
      label: t('posts.menu.copy.link'),
      onClick: () =>
        void copyText(options.externalHref, t('posts.copy.label.link'), t),
    },
    {
      key: 'copy-id',
      label: t('posts.menu.copy.id'),
      onClick: () => void copyText(post.id, t('posts.copy.label.id'), t),
    },
    {
      key: 'copy-slug',
      label: t('posts.menu.copy.slug'),
      onClick: () => void copyText(post.slug, t('posts.copy.label.slug'), t),
    },
  )

  const remove = actionToItem(find('delete'), post)
  if (remove) {
    items.push({ key: 'sep-3', type: 'divider' }, remove)
  }

  return items
}
