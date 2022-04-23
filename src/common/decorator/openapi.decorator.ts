import { ApiTags } from '@nestjs/swagger'

import { isDev } from '~/global/env.global'

export const ApiName: ClassDecorator = (target) => {
  if (!isDev) {
    return
  }
  const [name] = target.name.split('Controller')
  ApiTags(`${name} Routes`).call(null, target)
}
