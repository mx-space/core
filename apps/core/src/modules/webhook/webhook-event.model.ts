import { modelOptions } from '@typegoose/typegoose'

import { WEBHOOK_EVENT_COLLECTION_NAME } from '~/constants/db.constant'

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
    },
  },
  options: {
    customName: WEBHOOK_EVENT_COLLECTION_NAME,
  },
})
export class WebhookEventModel {}
