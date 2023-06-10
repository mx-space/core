import type { SubscribeTypeToBitMap } from '@core/modules/subscribe/subscribe.constant'

export * from '@core/modules/subscribe/subscribe.constant'

export type SubscribeType = keyof typeof SubscribeTypeToBitMap
