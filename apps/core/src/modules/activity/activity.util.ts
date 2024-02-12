const prefix = 'article-'
export const isValidRoomName = (roomName: string) => {
  return roomName.startsWith(prefix)
}

export const getArticleIdFromRoomName = (roomName: string) =>
  roomName.slice(prefix.length)

export const extractArticleIdFromRoomName = (roomName: string) => {
  return roomName.slice(prefix.length)
}
