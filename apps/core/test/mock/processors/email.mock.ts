import { EmailService } from '~/processors/helper/helper.email.service'
import { defineProvider } from 'test/helper/defineProvider'

export const emailProvider = defineProvider({
  provide: EmailService,
  useValue: {
    async send() {},
    render() {
      return ''
    },
    sendTestEmail() {
      return Promise.resolve()
    },
  },
})
