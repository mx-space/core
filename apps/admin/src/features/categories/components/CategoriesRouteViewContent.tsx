import { FolderOpen, Plus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import type { CategoryEntity } from '~/data/resources/category'
import { useI18n } from '~/i18n'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { useCategoriesList } from '../hooks/use-categories-list'
import { useCategoryMutations } from '../hooks/use-category-mutations'
import type { CategoryFormMode, SelectedItem } from '../types/categories'
import { CategoriesRouteContext } from './categories-route-context'
import { presentCategoryForm } from './CategoryFormModal'
import { CategoryRow } from './CategoryRow'
import { DetailEmpty } from './DetailEmpty'
import { EmptyList } from './EmptyList'
import { ListSection } from './ListSection'
import { TagRow } from './TagRow'

function encodeTarget(item: SelectedItem): string {
  if (item.kind === 'category') return `c-${item.id}`
  return `t-${encodeURIComponent(item.name)}`
}

function decodeTarget(raw: string | undefined): SelectedItem | null {
  if (!raw) return null
  if (raw.startsWith('c-')) return { id: raw.slice(2), kind: 'category' }
  if (raw.startsWith('t-')) {
    return { kind: 'tag', name: decodeURIComponent(raw.slice(2)) }
  }
  return { id: raw, kind: 'category' }
}

export function CategoriesRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const selectedItem = decodeTarget(params.id)

  const { categories, categoriesQuery, tags, tagsQuery } = useCategoriesList()

  const closeDetail = useCallback(() => {
    navigate('/posts/category')
  }, [navigate])

  const { deleteMutation, invalidateCategories } = useCategoryMutations({
    onAfterDeleteSuccess: () => {
      closeDetail()
    },
  })

  const selectItem = useCallback(
    (item: SelectedItem) => {
      navigate(`/posts/category/${encodeTarget(item)}`)
    },
    [navigate],
  )

  const openForm = useCallback(
    async (mode: CategoryFormMode) => {
      const category = await presentCategoryForm(mode)
      if (category) {
        navigate(
          `/posts/category/${encodeTarget({
            id: category.id,
            kind: 'category',
          })}`,
        )
        await invalidateCategories()
      }
    },
    [invalidateCategories, navigate],
  )

  const routeContextValue = useMemo(
    () => ({
      deleting: deleteMutation.isPending,
      onBack: closeDetail,
      onDelete: (category: CategoryEntity) => {
        if (
          window.confirm(t('categories.confirmDelete', { name: category.name }))
        ) {
          deleteMutation.mutate(category.id)
        }
      },
      onEdit: (category: CategoryEntity) =>
        void openForm({ category, kind: 'edit' }),
    }),
    [closeDetail, deleteMutation, openForm, t],
  )

  return (
    <CategoriesRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        emptyDetail={<DetailEmpty />}
        list={
          <section className="flex h-full min-h-0 flex-col">
            <div
              className={cn(
                'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
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
                loading={categoriesQuery.isLoading}
                title={t('categories.section.categories')}
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
                loading={tagsQuery.isLoading}
                title={t('categories.section.tags')}
              >
                {tags.length === 0 && !tagsQuery.isLoading ? (
                  <EmptyList label={t('categories.list.emptyTags')} />
                ) : (
                  tags.map((tag) => (
                    <TagRow
                      key={tag.name}
                      onSelect={() =>
                        selectItem({ kind: 'tag', name: tag.name })
                      }
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
      />
    </CategoriesRouteContext.Provider>
  )
}
