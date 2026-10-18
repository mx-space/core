import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Key, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteToken, getTokens } from '~/api/auth'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { accountQueryKey } from '../../constants'
import { formatDateTime, getErrorMessage } from '../../utils/settings'
import { presentCreateToken } from '../modals/TokenModals'
import { EmptyState } from '../SettingsPrimitives'

export function TokenPanelHeaderAction() {
  const { t } = useI18n()
  return (
    <Button
      onClick={() => {
        void presentCreateToken()
      }}
      type="button"
    >
      <Plus aria-hidden="true" className="size-4" />
      {t('settings.token.action.new')}
    </Button>
  )
}

export function TokenPanel() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const tokensQuery = useQuery({
    queryFn: getTokens,
    queryKey: adminQueryKeys.settings.tokens(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteToken,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.token.error.delete'))),
    onSuccess: async () => {
      toast.success(t('settings.token.success.delete'))
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
    },
  })

  return (
    <Scroll className="flex-1">
      {tokensQuery.isLoading ? (
        <div className="p-4 text-sm text-neutral-500">
          {t('settings.common.loading')}
        </div>
      ) : (tokensQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Key className="size-7" />}
          label={t('settings.token.empty')}
        />
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {tokensQuery.data?.map((token) => {
            return (
              <div className="p-4" key={token.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {token.name}
                    </h3>
                    <p className="mt-2 max-w-full truncate font-mono text-xs text-neutral-500">
                      {token.token}
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      {t('settings.token.createdAt', {
                        time: formatDateTime(token.createdAt),
                      })}
                      {token.expired
                        ? t('settings.token.createdExpireAt', {
                            time: formatDateTime(String(token.expired)),
                          })
                        : t('settings.token.createdNeverExpire')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => {
                        if (
                          window.confirm(
                            t('settings.token.confirm.delete', {
                              name: token.name,
                            }),
                          )
                        ) {
                          deleteMutation.mutate(token.id)
                        }
                      }}
                      type="button"
                      variant="subtle"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Scroll>
  )
}
