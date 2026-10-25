import { useQuery } from '@tanstack/react-query'
import { Loader2, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'

import { getCollabCrdt, getCollabWorkspace, postCollabCrdt } from '~/api/collab'
import { ApiRequestError } from '~/api/http'
import { PeerAvatars } from '~/features/write/components/collab/PeerAvatars'
import {
  type CrdtDraftRoom,
  useCrdtDraft,
} from '~/features/write/crdt/use-crdt-draft'
import { useI18n } from '~/i18n'
import { subscribeWebSocket } from '~/socket/web-socket'
import { EmptyState } from '~/ui/patterns/EmptyState'

import { CoauthorEditor } from './CoauthorEditor'

export function CollabDocumentPage() {
  const { t } = useI18n()
  const { documentId = '' } = useParams()
  const [title, setTitle] = useState('')
  const [revoked, setRevoked] = useState(false)
  const workspaceQuery = useQuery({
    enabled: Boolean(documentId),
    queryFn: () => getCollabWorkspace(documentId),
    queryKey: ['collab', 'workspace', documentId],
    retry: false,
  })
  const workspace = workspaceQuery.data
  const room = useMemo<CrdtDraftRoom | undefined>(
    () =>
      workspace && {
        author: `human:${workspace.me.id}`,
        http: {
          pull: (since) => getCollabCrdt(documentId, since),
          push: (bytes) => postCollabCrdt(documentId, bytes),
        },
        subscribeSocket: subscribeWebSocket,
      },
    [documentId, workspace],
  )
  const crdt = useCrdtDraft({
    draftId: workspace?.draftId ?? '',
    enabled: Boolean(room) && !revoked,
    onRejected: async () => {
      toast.error(t('collab.document.rejected'))
    },
    onRemoteTitle: setTitle,
    onRevoked: () => setRevoked(true),
    room,
  })

  if (revoked || workspaceQuery.error) {
    const forbidden =
      revoked ||
      (workspaceQuery.error instanceof ApiRequestError &&
        workspaceQuery.error.status === 403)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-page p-4">
        <EmptyState
          description={
            forbidden
              ? t('collab.document.revokedDescription')
              : t('collab.document.unavailableDescription')
          }
          icon={UserX}
          title={
            forbidden
              ? t('collab.document.revokedTitle')
              : t('collab.document.unavailableTitle')
          }
        />
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-page">
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-surface-page">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-surface-page/90 px-4 backdrop-blur">
        <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
          {t('collab.document.editingAs', { name: workspace.me.name })}
        </span>
        {crdt.status === 'offline' ? (
          <span className="text-xs text-fg-subtle">
            {t('collab.document.offline')}
          </span>
        ) : null}
        <PeerAvatars peers={crdt.peers} selfId={workspace.me.id} />
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-8">
        <input
          aria-label={t('collab.document.titleLabel')}
          className="w-full bg-transparent text-2xl font-semibold text-fg outline-hidden placeholder:text-fg-subtle"
          disabled={!crdt.active}
          onChange={(event) => {
            setTitle(event.target.value)
            crdt.setTitle(event.target.value)
          }}
          placeholder={t('write.editor.untitled')}
          value={title}
        />
        <CoauthorEditor
          crdt={crdt}
          variant={workspace.refType === 'note' ? 'note' : 'article'}
        />
      </div>
    </main>
  )
}
