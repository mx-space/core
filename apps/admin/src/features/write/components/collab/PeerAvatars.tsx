import { type CSSProperties, useState } from 'react'

import { useI18n } from '~/i18n'

import type { RemotePresence } from '../../crdt/collab-presence'
import { type PeersSource, usePeers } from '../../crdt/peers-store'

const VISIBLE = 4

const onePerPerson = (peers: RemotePresence[]) => {
  const seen = new Set<string>()
  return peers.filter((peer) => {
    if (seen.has(peer.user.id)) return false
    seen.add(peer.user.id)
    return true
  })
}

export function PeerAvatars(props: { peers: PeersSource; selfId: string }) {
  const { t } = useI18n()
  const people = onePerPerson(usePeers(props.peers))
  if (!people.length) return null
  const visible = people.slice(0, VISIBLE)
  const hidden = people.length - visible.length

  return (
    <div
      aria-label={t('write.collab.editing')}
      className="flex items-center -space-x-2"
      role="group"
    >
      {visible.map((peer, index) => {
        const name = peer.user.name || '?'
        const title =
          peer.user.id === props.selfId
            ? t('write.collab.peerOtherTab', { name })
            : name
        return (
          <span
            className="relative inline-flex size-6 items-center justify-center overflow-hidden rounded-full border-[1.5px] bg-surface-inset text-xs font-medium text-fg ring-2 ring-surface-page transition-transform hover:z-10 hover:-translate-y-0.5"
            data-peer={peer.key}
            key={peer.key}
            style={
              {
                borderColor: peer.color,
                zIndex: visible.length - index,
              } as CSSProperties
            }
            title={title}
          >
            <PeerFace avatar={peer.user.avatar} name={name} />
          </span>
        )
      })}
      {hidden > 0 ? (
        <span
          className="relative inline-flex size-6 items-center justify-center rounded-full bg-surface-inset text-xs text-fg-muted ring-2 ring-surface-page"
          title={t('write.collab.more', { count: hidden })}
        >
          +{hidden}
        </span>
      ) : null}
    </div>
  )
}

function PeerFace(props: { avatar: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!props.avatar || failed === props.avatar) {
    return <>{props.name.slice(0, 1).toUpperCase()}</>
  }
  return (
    <img
      alt=""
      className="size-full object-cover"
      onError={() => setFailed(props.avatar)}
      src={props.avatar}
    />
  )
}
