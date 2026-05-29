import { Plus, Quote } from 'lucide-react'

import { ContentListHeader } from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import type { SayModel } from '~/models/say'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { saysPageSize } from '../constants'
import { useSayMutations } from '../hooks/use-say-mutations'
import { useSaysList } from '../hooks/use-says-list'
import { presentSayEditor } from './SayEditorModal'
import { SayEmptyState } from './SayEmptyState'
import { SayListItem } from './SayListItem'
import { SayListSkeleton } from './SayListSkeleton'

export function SaysRouteViewContent() {
  const { t } = useI18n()
  const { page, pagination, says, saysQuery, setPage } = useSaysList()
  const { deleteMutation, invalidateSays } = useSayMutations()

  const openEditor = async (say: SayModel | null) => {
    const ok = await presentSayEditor(say)
    if (ok) {
      await invalidateSays()
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <ContentListHeader
        action={
          <Button
            onClick={() => void openEditor(null)}
            type="button"
            variant="subtle"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t('says.addOne')}
          </Button>
        }
        count={
          pagination
            ? t('says.countLabel', { count: pagination.total })
            : t('common.loading')
        }
        icon={<Quote aria-hidden="true" className="size-4" />}
        title={t('says.title')}
      />

      <Scroll className="flex-1">
        {saysQuery.isLoading && says.length === 0 ? (
          <SayListSkeleton />
        ) : says.length === 0 ? (
          <SayEmptyState onCreate={() => void openEditor(null)} />
        ) : (
          <div className="mx-auto max-w-5xl">
            {says.map((say) => (
              <SayListItem
                key={say.id}
                onDelete={(id) => deleteMutation.mutate(id)}
                onEdit={() => void openEditor(say)}
                say={say}
              />
            ))}
          </div>
        )}
      </Scroll>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex shrink-0 justify-center border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <CompactPagination
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={pagination.totalPages}
            pageSize={saysPageSize}
            pageSizes={[saysPageSize]}
          />
        </div>
      ) : null}
    </section>
  )
}
