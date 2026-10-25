import type { CSSProperties } from 'react'

import { useI18n } from '~/i18n'

import type { RemotePresence } from '../../crdt/collab-presence'

const VISIBLE = 4

export function PeerAvatars(props: {
  peers: RemotePresence[]
  selfId: string
}) {
  const { t } = useI18n()
  if (!props.peers.length) return null
  const visible = props.peers.slice(0, VISIBLE)
  const hidden = props.peers.length - visible.length

  return (
    <div
      aria-label={t('write.collab.editing')}
      className="flex items-center -space-x-1.5"
      role="group"
    >
      {visible.map((peer) => {
        const name = peer.user.name || '?'
        const title =
          peer.user.id === props.selfId
            ? t('write.collab.peerOtherTab', { name })
            : name
        return (
          <span
            className="relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full bg-surface-inset text-xs font-medium text-fg ring-2"
            data-peer={peer.key}
            key={peer.key}
            style={{ '--tw-ring-color': peer.color } as CSSProperties}
            title={title}
          >
            {peer.user.avatar ? (
              <img
                alt=""
                className="size-full object-cover"
                src={peer.user.avatar}
              />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </span>
        )
      })}
      {hidden > 0 ? (
        <span
          className="relative inline-flex size-7 items-center justify-center rounded-full bg-surface-inset text-xs text-fg-muted ring-2 ring-background"
          title={t('write.collab.more', { count: hidden })}
        >
          +{hidden}
        </span>
      ) : null}
    </div>
  )
}
