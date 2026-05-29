import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { toast } from 'sonner'
import type { CreateCategoryData } from '~/api/categories'
import type { CategoryModel } from '~/models/category'
import type { CategoryFormMode } from '../types/categories'

import { createCategory, updateCategory } from '~/api/categories'
import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import { getErrorMessage } from '../utils/errors'

interface CategoryFormModalProps {
  mode: CategoryFormMode
}

function CategoryFormModal(props: CategoryFormModalProps) {
  const { t } = useI18n()
  const modal = useModal<CategoryModel>()
  const [name, setName] = useState(
    props.mode.kind === 'edit' ? props.mode.category.name : '',
  )
  const [slug, setSlug] = useState(
    props.mode.kind === 'edit' ? props.mode.category.slug : '',
  )
  const title =
    props.mode.kind === 'edit'
      ? t('categories.form.editTitle')
      : t('categories.form.createTitle')

  const mutation = useMutation({
    mutationFn: (data: CreateCategoryData) =>
      props.mode.kind === 'edit'
        ? updateCategory(props.mode.category.id, { ...data, type: 0 })
        : createCategory(data),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('categories.form.saveFailed'))),
    onSuccess: (category) => {
      toast.success(
        props.mode.kind === 'edit'
          ? t('categories.form.updated')
          : t('categories.form.created'),
      )
      modal.close(category)
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
    }

    if (!payload.name || !payload.slug) {
      toast.error(t('categories.form.validateRequired'))
      return
    }

    mutation.mutate(payload)
  }

  return (
    <form className="flex w-full flex-col" onSubmit={onSubmit}>
      <ModalHeader subtitle={t('categories.form.subtitle')} title={title} />
      <div className="grid gap-4 p-5">
        <TextInput
          autoFocus
          label={t('categories.form.name')}
          labelClassName="text-xs text-neutral-500 dark:text-neutral-400"
          onChange={setName}
          value={name}
        />
        <TextInput
          controlClassName="font-mono"
          label={t('categories.form.slug')}
          labelClassName="text-xs text-neutral-500 dark:text-neutral-400"
          onChange={setSlug}
          value={slug}
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}

/**
 * Open the category form modal. Resolves with the saved category on success.
 */
export async function presentCategoryForm(
  mode: CategoryFormMode,
): Promise<CategoryModel | undefined> {
  const handle = present<CategoryFormModalProps, CategoryModel>(
    CategoryFormModal,
    { mode },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 28rem)' } },
    },
  )
  return await handle
}
