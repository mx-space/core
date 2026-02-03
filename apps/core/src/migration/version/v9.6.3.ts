import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.6.3-flatten-smtp-options',
  async (db: Db) => {
    const optionsCollection = db.collection('options')

    const mailOptionsDoc = await optionsCollection.findOne({
      name: 'mailOptions',
    })

    if (mailOptionsDoc?.value?.smtp?.options) {
      const { smtp } = mailOptionsDoc.value as any
      const { options, ...restSmtp } = smtp

      await optionsCollection.updateOne(
        { name: 'mailOptions' },
        {
          $set: {
            'value.smtp': {
              ...restSmtp,
              host: options?.host ?? '',
              port: options?.port ?? 465,
              secure: options?.secure ?? true,
            },
          },
        },
      )
    }
  },
)
