const prefix = 'article-'

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
