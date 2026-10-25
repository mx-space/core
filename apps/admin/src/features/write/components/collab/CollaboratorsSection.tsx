import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Loader2, Trash2, UserMinus, Users } from 'lucide-react'
import { toast } from 'sonner'

import {
  collabInviteUrlOf,
  createCollabInvite,
  listCollabInvites,
  listCollaborators,
  removeCollaborator,
  revokeCollabInvite,
  updateCollaborator,
} from '~/api/collab'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'

export function CollaboratorsSection(props: { documentId: string }) {
  const { format, t } = useI18n()
  const queryClient = useQueryClient()
  const { documentId } = props
  const invitesKey = adminQueryKeys.collab.invites(documentId)
  const collaboratorsKey = adminQueryKeys.collab.collaborators(documentId)
  const invitesQuery = useQuery({
    queryFn: () => listCollabInvites(documentId),
    queryKey: invitesKey,
  })
  const collaboratorsQuery = useQuery({
    queryFn: () => listCollaborators(documentId),
    queryKey: collaboratorsKey,
  })
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: invitesKey }),
      queryClient.invalidateQueries({ queryKey: collaboratorsKey }),
    ])

  const createInvite = useMutation({
    mutationFn: () => createCollabInvite(documentId),
    onError: () => toast.error(t('write.collaborators.failed')),
    onSuccess: async (invite) => {
      await navigator.clipboard
        .writeText(collabInviteUrlOf(invite.token))
        .catch(() => undefined)
      toast.success(t('write.collaborators.linkCopied'))
      await refresh()
    },
  })
  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => revokeCollabInvite(documentId, inviteId),
    onSuccess: refresh,
  })
  const toggleByline = useMutation({
    mutationFn: (input: { readerId: string; showInByline: boolean }) =>
      updateCollaborator(documentId, input.readerId, {
        showInByline: input.showInByline,
      }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (readerId: string) => removeCollaborator(documentId, readerId),
    onSuccess: async () => {
      toast.success(t('write.collaborators.removed'))
      await refresh()
    },
  })

  const invites = invitesQuery.data ?? []
  const collaborators = collaboratorsQuery.data ?? []

  return (
    <section
      aria-label={t('write.collaborators.title')}
      className="flex flex-col gap-2 border-b border-border px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <Users aria-hidden="true" className="size-3.5 text-fg-muted" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">
          {t('write.collaborators.title')}
        </span>
        <Button
          className="h-7 shrink-0 px-2 text-xs"
          disabled={createInvite.isPending}
          onClick={() => createInvite.mutate()}
          type="button"
          variant="ghost"
        >
          {createInvite.isPending ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Link2 aria-hidden="true" className="size-3.5" />
          )}
          {t('write.collaborators.invite')}
        </Button>
      </div>
      <p className="pl-5.5 text-xs text-fg-subtle" data-history-notice>
        {t('write.collaborators.historyNotice')}
      </p>
      {invites.map((invite) => (
        <div className="flex items-center gap-2 pl-5.5" key={invite.id}>
          <Copy aria-hidden="true" className="size-3 text-fg-subtle" />
          <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
            {t('write.collaborators.linkExpires', {
              time: format.relativeTime(new Date(invite.expiresAt).getTime()),
              uses: invite.uses,
            })}
          </span>
          <Button
            aria-label={t('write.collaborators.revokeLink')}
            className="size-7 shrink-0 p-0"
            disabled={revokeInvite.isPending}
            onClick={() => revokeInvite.mutate(invite.id)}
            title={t('write.collaborators.revokeLink')}
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      ))}
      {collaborators.map((person) => (
        <div
          className="flex items-center gap-2 pl-5.5"
          data-collaborator={person.readerId}
          key={person.readerId}
        >
          <span className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-inset text-xs text-fg">
            {person.avatar ? (
              <img
                alt=""
                className="size-full object-cover"
                src={person.avatar}
              />
            ) : (
              (person.name || '?').slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-fg">
            {person.name}
          </span>
          <label className="flex shrink-0 items-center gap-1 text-xs text-fg-muted">
            <input
              checked={person.showInByline}
              disabled={toggleByline.isPending}
              onChange={(event) =>
                toggleByline.mutate({
                  readerId: person.readerId,
                  showInByline: event.target.checked,
                })
              }
              type="checkbox"
            />
            {t('write.collaborators.byline')}
          </label>
          <Button
            aria-label={t('write.collaborators.remove', { name: person.name })}
            className="size-7 shrink-0 p-0"
            disabled={remove.isPending}
            onClick={() => remove.mutate(person.readerId)}
            title={t('write.collaborators.remove', { name: person.name })}
            type="button"
            variant="ghost"
          >
            <UserMinus aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      ))}
    </section>
  )
}
