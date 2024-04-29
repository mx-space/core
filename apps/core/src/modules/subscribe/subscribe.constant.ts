export const SubscribePostCreateBit = Math.trunc(1)
export const SubscribeNoteCreateBit = 1 << 1
export const SubscribeSayCreateBit = 1 << 2
export const SubscribeRecentCreateBit = 1 << 3
export const SubscribeAllBit =
  SubscribePostCreateBit |
  SubscribeNoteCreateBit |
  SubscribeSayCreateBit |
  SubscribeRecentCreateBit

export const SubscribeTypeToBitMap = {
  post_c: SubscribePostCreateBit,
  note_c: SubscribeNoteCreateBit,
  say_c: SubscribeSayCreateBit,
  recently_c: SubscribeRecentCreateBit,
  all: SubscribeAllBit,
}
