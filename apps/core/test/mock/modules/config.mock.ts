import { defineProvider } from 'test/helper/defineProvider'

import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { ConfigsService } from '~/modules/configs/configs.service'

export const configProvider = defineProvider({
  provide: ConfigsService,
  useValue: {
    defaultConfig: generateDefaultConfig(),
    async get(key) {
      return this.defaultConfig[key]
    },
    async getConfig() {
      return this.defaultConfig
    },
    async waitForConfigReady() {
      return this.defaultConfig
    },
  },
})
