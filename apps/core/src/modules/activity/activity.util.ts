const prefix = 'article-'

export const buildArticleRoomName = (articleId: string) =>
  `${prefix}${articleId}`

export const isValidRoomName = (roomName: string) => {
  return roomName.startsWith(prefix)
}

export const extractArticleIdFromRoomName = (roomName: string) => {
  return roomName.slice(prefix.length)
}

export const parseRoomName = (roomName: string) => {
  const prefix = roomName.split('-')[0]
  switch (prefix) {
    case 'article': {
      return {
        type: 'article',
        refId: extractArticleIdFromRoomName(roomName),
      }
    }
  }
}
