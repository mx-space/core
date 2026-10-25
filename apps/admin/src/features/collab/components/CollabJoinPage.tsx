import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

import { acceptCollabInvite } from '~/api/collab'
import { ApiRequestError, getJson } from '~/api/http'
import { getEditPathForDraft } from '~/features/drafts/utils/draft-edit-path'
import { useI18n } from '~/i18n'
import {
  authBackdropClassName,
  authBackdropStyle,
  authCardClassName,
  authIconTileClassName,
} from '~/lib/auth-backdrop'
import type { DraftRefType } from '~/models/draft'
import { Button } from '~/ui/primitives/button'
import { authClient } from '~/utils/authjs/auth'
import { cn } from '~/utils/cn'

const PROVIDER_LABELS: Record<string, string> = {
  apple: 'Apple',
  github: 'GitHub',
  google: 'Google',
}

export function CollabJoinPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { token = '' } = useParams()
  const session = useQuery({
    queryFn: async () => (await authClient.getSession()).data ?? null,
    queryKey: ['collab', 'session'],
    retry: false,
  })
  const signedIn = Boolean(session.data?.user)
  const providersQuery = useQuery({
    enabled: !session.isPending && !signedIn,
    queryFn: () => getJson<string[]>('/auth/providers'),
    queryKey: ['collab', 'providers'],
  })
  const accept = useMutation({
    mutationFn: () => acceptCollabInvite(token),
    onSuccess: (result) => {
      if (result.role === 'owner') {
        navigate(
          getEditPathForDraft({
            document: {
              refId: result.refId,
              refType: result.refType as DraftRefType,
            },
            id: result.draftId,
          }),
          { replace: true },
        )
        return
      }
      navigate(`/collab/${result.documentId}`, { replace: true })
    },
  })

  useEffect(() => {
    if (signedIn && accept.isIdle) accept.mutate()
  }, [accept, signedIn])

  const signIn = (provider: string) => {
    void authClient.signIn.social({
      callbackURL: window.location.href,
      provider,
    })
  }

  const failure =
    accept.error instanceof ApiRequestError
      ? accept.error.code === 'COLLAB_INVITE_INVALID'
        ? t('collab.join.invalid')
        : accept.error.message
      : accept.error
        ? t('collab.join.failed')
        : null

  return (
    <main
      className={cn(authBackdropClassName, 'flex items-center justify-center')}
      style={authBackdropStyle}
    >
      <section
        className={cn(
          authCardClassName,
          'flex max-w-sm flex-col items-center gap-4 text-center',
        )}
      >
        <div className={authIconTileClassName}>
          <Users aria-hidden="true" className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-medium text-fg">
            {t('collab.join.title')}
          </h1>
          <p className="text-sm text-fg-muted">
            {failure ??
              (signedIn
                ? t('collab.join.accepting')
                : t('collab.join.signInHint'))}
          </p>
        </div>
        {session.isPending || accept.isPending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {!session.isPending && !signedIn ? (
          <div className="flex w-full flex-col gap-2">
            {(providersQuery.data ?? []).map((provider) => (
              <Button
                className="w-full"
                key={provider}
                onClick={() => signIn(provider)}
                type="button"
                variant="secondary"
              >
                {t('collab.join.signInWith', {
                  provider: PROVIDER_LABELS[provider] ?? provider,
                })}
              </Button>
            ))}
            {providersQuery.isSuccess && !providersQuery.data.length ? (
              <p className="text-xs text-fg-subtle">
                {t('collab.join.noProviders')}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
