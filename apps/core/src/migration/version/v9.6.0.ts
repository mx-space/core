import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.6.0-migrate-mail-options-structure',
  async (db: Db) => {
    const optionsCollection = db.collection('options')

    // 1. 迁移 mailOptions: 将 user/pass/options 移动到 smtp 子对象
    const mailOptionsDoc = await optionsCollection.findOne({
      name: 'mailOptions',
    })
    if (mailOptionsDoc?.value) {
      const { user, pass, options, ...rest } = mailOptionsDoc.value as any

      // 只有当旧字段存在时才迁移
      if (user !== undefined || pass !== undefined || options !== undefined) {
        await optionsCollection.updateOne(
          { name: 'mailOptions' },
          {
            $set: {
              value: {
                ...rest,
                smtp: {
                  user: user ?? '',
                  pass: pass ?? '',
                  options: options ?? { host: '', port: 465, secure: true },
                },
                resend: rest.resend ?? { apiKey: '' },
              },
            },
          },
        )
      }
    }

    // 2. 迁移 resendApiKey: 从 thirdPartyServiceIntegration 移动到 mailOptions.resend
    const thirdPartyDoc = await optionsCollection.findOne({
      name: 'thirdPartyServiceIntegration',
    })
    if (thirdPartyDoc?.value?.resendApiKey) {
      // 更新 mailOptions 中的 resend.apiKey
      await optionsCollection.updateOne(
        { name: 'mailOptions' },
        { $set: { 'value.resend.apiKey': thirdPartyDoc.value.resendApiKey } },
      )

      // 移除 thirdPartyServiceIntegration 中的 resendApiKey
      await optionsCollection.updateOne(
        { name: 'thirdPartyServiceIntegration' },
        { $unset: { 'value.resendApiKey': '' } },
      )
    }
  },
)
