import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getOwner } from '~/api/options'
import { useI18n } from '~/i18n'
import type {
  CommentAuthorActivity,
  CommentModel,
  CommentThreadResponse,
} from '~/models/comment'
import { CommentState } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'
import { Drawer } from '~/ui/feedback/drawer'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { useOptionalCommentsRouteContext } from './comments-route-context'
import { DetailHeader } from './DetailHeader'
import { MetaSidebar } from './MetaSidebar'
import type { ReplyComposerHandle } from './ReplyComposer'
import { ReplyComposer } from './ReplyComposer'
import { ThreadColumn } from './ThreadColumn'

interface CommentDetailProps {
  comment: CommentModel
  onBack: () => void
  onDelete: (id: string) => void
  onReply: (id: string, text: string) => Promise<CommentModel>
  onStateChange: (id: string, state: CommentState) => void
  replyPending: boolean
  thread?: CommentThreadResponse
  threadLoading?: boolean
  activity?: CommentAuthorActivity
  activityLoading?: boolean
}

export function CommentDetail(props: CommentDetailProps) {
  const { t } = useI18n()
  const [pendingReplies, setPendingReplies] = useState<CommentModel[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const composerRef = useRef<ReplyComposerHandle | null>(null)
  const activeCommentIdRef = useRef(props.comment.id)
  activeCommentIdRef.current = props.comment.id
  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: adminQueryKeys.comments.owner(),
    staleTime: 5 * 60 * 1000,
  })

  const ownerName =
    ownerQuery.data?.name ||
    ownerQuery.data?.username ||
    ownerQuery.data?.handle ||
    t('comments.owner.fallback')

  const threadParticipants = useMemo(() => {
    const seen = new Set<string>()
    const collected: { name: string }[] = []
    const push = (name?: string | null) => {
      if (!name) return
      if (seen.has(name)) return
      seen.add(name)
      collected.push({ name })
    }
    for (const item of props.thread?.thread ?? []) push(item.author)
    push(props.comment.author)
    return collected
  }, [props.thread?.thread, props.comment.author])

  useEffect(() => {
    setPendingReplies([])
    setDrawerOpen(false)
  }, [props.comment.id])

  const routeCtx = useOptionalCommentsRouteContext()
  useEffect(() => {
    if (!routeCtx) return
    const focus = () => composerRef.current?.focus()
    routeCtx.registerComposerFocus(focus)
    return () => routeCtx.registerComposerFocus(null)
  }, [routeCtx])

  const handleReply = async (text: string) => {
    const commentId = props.comment.id
    const reply = await props.onReply(commentId, text)
    if (activeCommentIdRef.current !== commentId) return

    setPendingReplies((current) =>
      current.some((entry) => entry.id === reply.id)
        ? current
        : [...current, reply],
    )
  }

  const pendingMessages = useMemo(() => {
    const persistedIds = new Set(
      props.thread?.thread.map((entry) => entry.id) ?? [],
    )
    return pendingReplies.filter((reply) => !persistedIds.has(reply.id))
  }, [pendingReplies, props.thread?.thread])

  const sidebarContent = (
    <MetaSidebar
      activity={props.activity}
      activityLoading={props.activityLoading}
      comment={props.comment}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        canMarkJunk={props.comment.state !== CommentState.Junk}
        canMarkRead={props.comment.state !== CommentState.Read}
        comment={props.comment}
        infoToggle={
          <Button
            aria-label={t('comments.sidebar.toggle')}
            className="h-8 w-8 p-0 desktop:hidden"
            onClick={() => setDrawerOpen(true)}
            type="button"
            variant="ghost"
          >
            <Info aria-hidden="true" className="size-4" />
          </Button>
        }
        onBack={props.onBack}
        onDelete={() => props.onDelete(props.comment.id)}
        onMarkJunk={() =>
          props.onStateChange(props.comment.id, CommentState.Junk)
        }
        onMarkRead={() =>
          props.onStateChange(props.comment.id, CommentState.Read)
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Scroll className="flex-1" innerClassName="px-4 py-6">
            {props.threadLoading && !props.thread ? (
              <div className="flex justify-center py-12">
                <div className="size-6 animate-spin rounded-full border-2 border-border border-t-accent" />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl">
                <ThreadColumn
                  comment={props.comment}
                  ownerName={ownerName}
                  pendingMessages={pendingMessages}
                  thread={props.thread}
                />
              </div>
            )}
          </Scroll>

          {props.comment.state !== CommentState.Junk &&
          !props.comment.isDeleted ? (
            <div className="shrink-0 border-t border-border bg-surface-card">
              <ReplyComposer
                handleRef={composerRef}
                onSubmit={handleReply}
                ownerName={ownerName}
                pending={props.replyPending}
                threadParticipants={threadParticipants}
              />
            </div>
          ) : null}
        </div>

        <aside
          aria-label={t('comments.sidebar.meta')}
          className="hidden w-[260px] shrink-0 border-l border-border desktop:flex desktop:min-h-0 desktop:flex-col"
        >
          <Scroll className="flex-1" innerClassName="px-4 py-4">
            {sidebarContent}
          </Scroll>
        </aside>
      </div>

      <Drawer
        icon={Info}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        side="right"
        title={t('comments.sidebar.meta')}
      >
        <Scroll className="flex-1" innerClassName="p-4">
          {sidebarContent}
        </Scroll>
      </Drawer>
    </div>
  )
}
