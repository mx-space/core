import { defineProvider } from 'test/helper/defineProvider'

import { EmailService } from '~/processors/helper/helper.email.service'

export const emailProvider = defineProvider({
  provide: EmailService,
  useValue: {
    async send(options) {},
    render(template, source) {
      return ''
    },
    sendTestEmail() {
      return Promise.resolve()
    },
  },
})
