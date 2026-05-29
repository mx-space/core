import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { CategoryFormMode, SelectedItem } from '../types/categories'

import { deleteCategory, getCategories, getTags } from '~/api/categories'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { getErrorMessage } from '../utils/errors'
import { CategoryDetail } from './CategoryDetail'
import { presentCategoryForm } from './CategoryFormModal'
import { CategoryRow } from './CategoryRow'
import { DetailEmpty } from './DetailEmpty'
import { EmptyList } from './EmptyList'
import { ListSection } from './ListSection'
import { TagDetail } from './TagDetail'
import { TagRow } from './TagRow'

export function CategoriesRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)

  const categoriesQuery = useQuery({
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: ['categories', 'list'],
  })
  const tagsQuery = useQuery({
    queryFn: getTags,
    queryKey: ['categories', 'tags'],
  })

  const categories = categoriesQuery.data ?? []
  const tags = tagsQuery.data ?? []
  const selectedCategory =
    selectedItem?.kind === 'category'
      ? categories.find((item) => item.id === selectedItem.id)
      : null
  const selectedTag =
    selectedItem?.kind === 'tag'
      ? tags.find((item) => item.name === selectedItem.name)
      : null

  useEffect(() => {
    if (!selectedItem) return
    if (
      selectedItem.kind === 'category' &&
      categories.length > 0 &&
      !categories.some((item) => item.id === selectedItem.id)
    ) {
      setSelectedItem(null)
      setShowDetailOnMobile(false)
    }
    if (
      selectedItem.kind === 'tag' &&
      tags.length > 0 &&
      !tags.some((item) => item.name === selectedItem.name)
    ) {
      setSelectedItem(null)
      setShowDetailOnMobile(false)
    }
  }, [categories, selectedItem, tags])

  const invalidateCategories = async () => {
    await queryClient.invalidateQueries({ queryKey: ['categories'] })
    await queryClient.invalidateQueries({ queryKey: ['posts'] })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('categories.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('categories.toast.deleted'))
      setSelectedItem(null)
      setShowDetailOnMobile(false)
      await invalidateCategories()
    },
  })

  const selectItem = (item: SelectedItem) => {
    setSelectedItem(item)
    setShowDetailOnMobile(true)
  }

  const openForm = async (mode: CategoryFormMode) => {
    const category = await presentCategoryForm(mode)
    if (category) {
      setSelectedItem({ id: category.id, kind: 'category' })
      setShowDetailOnMobile(true)
      await invalidateCategories()
    }
  }

  return (
    <MasterDetailLayout
      showDetailOnMobile={showDetailOnMobile}
      list={
        <section className="flex h-full min-h-0 flex-col">
          <div
            className={cn(
              'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
              APP_SHELL_HEADER_HEIGHT_CLASS,
            )}
          >
            <div className="min-w-0">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
                <FolderOpen aria-hidden="true" className="size-4" />
                {t('categories.list.title')}
              </h2>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {categories.length} / {tags.length}
            </span>
            <Button
              onClick={() => void openForm({ kind: 'create' })}
              type="button"
              variant="subtle"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t('categories.list.new')}
            </Button>
          </div>

          <Scroll className="min-h-0 flex-1">
            <ListSection
              count={categories.length}
              title={t('categories.section.categories')}
              loading={categoriesQuery.isLoading}
            >
              {categories.length === 0 && !categoriesQuery.isLoading ? (
                <EmptyList
                  action={
                    <Button
                      className="mt-3"
                      onClick={() => void openForm({ kind: 'create' })}
                      type="button"
                    >
                      {t('categories.list.create')}
                    </Button>
                  }
                  label={t('categories.list.emptyCategories')}
                />
              ) : (
                categories.map((category) => (
                  <CategoryRow
                    category={category}
                    key={category.id}
                    onSelect={() =>
                      selectItem({ id: category.id, kind: 'category' })
                    }
                    selected={
                      selectedItem?.kind === 'category' &&
                      selectedItem.id === category.id
                    }
                  />
                ))
              )}
            </ListSection>

            <ListSection
              count={tags.length}
              title={t('categories.section.tags')}
              loading={tagsQuery.isLoading}
            >
              {tags.length === 0 && !tagsQuery.isLoading ? (
                <EmptyList label={t('categories.list.emptyTags')} />
              ) : (
                tags.map((tag) => (
                  <TagRow
                    key={tag.name}
                    onSelect={() => selectItem({ kind: 'tag', name: tag.name })}
                    selected={
                      selectedItem?.kind === 'tag' &&
                      selectedItem.name === tag.name
                    }
                    tag={tag}
                  />
                ))
              )}
            </ListSection>
          </Scroll>
        </section>
      }
      detail={
        <section className="h-full min-h-0">
          {selectedCategory ? (
            <CategoryDetail
              category={selectedCategory}
              deleting={deleteMutation.isPending}
              onBack={() => setShowDetailOnMobile(false)}
              onDelete={(category) => {
                if (
                  window.confirm(
                    t('categories.confirmDelete', { name: category.name }),
                  )
                ) {
                  deleteMutation.mutate(category.id)
                }
              }}
              onEdit={(category) => void openForm({ category, kind: 'edit' })}
            />
          ) : selectedTag ? (
            <TagDetail
              onBack={() => setShowDetailOnMobile(false)}
              tag={selectedTag}
            />
          ) : (
            <DetailEmpty />
          )}
        </section>
      }
    />
  )
}
