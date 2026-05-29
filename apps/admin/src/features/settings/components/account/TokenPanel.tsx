import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Key, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { TokenModel } from '~/models/token'

import { deleteToken, getToken, getTokens } from '~/api/auth'
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
  const [visibleTokens, setVisibleTokens] = useState<Record<string, string>>({})

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

  const revealToken = async (token: TokenModel) => {
    if (visibleTokens[token.id]) {
      setVisibleTokens((current) => {
        const next = { ...current }
        delete next[token.id]
        return next
      })
      return
    }

    try {
      const detail = await getToken(token.id)
      setVisibleTokens((current) => ({ ...current, [token.id]: detail.token }))
    } catch (error) {
      toast.error(getErrorMessage(error, t('settings.token.error.detail')))
    }
  }

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
            const visible = visibleTokens[token.id]
            return (
              <div className="p-4" key={token.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {token.name}
                    </h3>
                    <button
                      className="mt-2 max-w-full truncate font-mono text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      onClick={() => {
                        if (visible) void navigator.clipboard.writeText(visible)
                      }}
                      type="button"
                    >
                      {visible || '••••••••••••••••••••••••'}
                    </button>
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
                      onClick={() => void revealToken(token)}
                      type="button"
                      variant="subtle"
                    >
                      {visible ? (
                        <EyeOff aria-hidden="true" className="size-4" />
                      ) : (
                        <Eye aria-hidden="true" className="size-4" />
                      )}
                    </Button>
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
