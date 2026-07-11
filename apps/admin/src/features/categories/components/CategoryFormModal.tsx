import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CategoryEntity } from '~/data/resources/category'
import { saveCategory } from '~/data/resources/category.mutations'
import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import type { CategoryFormMode } from '../types/categories'
import { getErrorMessage } from '../utils/errors'

interface CategoryFormModalProps {
  mode: CategoryFormMode
}

function CategoryFormModal(props: CategoryFormModalProps) {
  const { t } = useI18n()
  const modal = useModal<CategoryEntity>()
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
    mutationFn: (data: { name: string; slug: string }) =>
      saveCategory(
        props.mode.kind === 'edit'
          ? { id: props.mode.category.id, kind: 'edit' }
          : { kind: 'create' },
        data,
      ),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('categories.form.saveFailed'))),
    onSuccess: (category) => {
      if (!category) return
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
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('common.save')}
        </Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the category form modal. Resolves with the saved category on success.
 */
export async function presentCategoryForm(
  mode: CategoryFormMode,
): Promise<CategoryEntity | undefined> {
  const handle = present<CategoryFormModalProps, CategoryEntity>(
    CategoryFormModal,
    { mode },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 28rem)' } },
    },
  )
  return await handle
}
