const prefix = 'article-'

export function resolvePresenceReaderId(
  sessionReaderId?: string | null,
  socketReaderId?: string | null,
  _clientReaderId?: string | null,
): string | undefined {
  return sessionReaderId || socketReaderId || undefined
}

export function toPublicPresenceReader(reader: {
  id: string | number | bigint
  name?: string | null
  image?: string | null
  handle?: string | null
}) {
  return {
    id: String(reader.id),
    name: reader.name ?? null,
    image: reader.image ?? null,
    handle: reader.handle ?? null,
  }
}

export const buildArticleRoomName = (articleId: string) =>
  `${prefix}${articleId}`

export const isValidRoomName = (roomName: string) => roomName.startsWith(prefix)

export const extractArticleIdFromRoomName = (roomName: string) =>
  roomName.slice(prefix.length)

export const parseRoomName = (roomName: string) => {
  if (roomName.split('-')[0] !== 'article') return undefined
  return {
    type: 'article' as const,
    refId: extractArticleIdFromRoomName(roomName),
  }
}
