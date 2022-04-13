import { Controller, applyDecorators } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { Auth } from '~/common/decorator/auth.decorator'

export function OptionController(name?: string, postfixRoute?: string) {
  const routes = ['options', 'config', 'setting', 'configs', 'option']
  return applyDecorators(
    Auth(),
    Controller(
      postfixRoute ? routes.map((route) => `${route}/${postfixRoute}`) : routes,
    ),
    ApiTags(`${name ? `${name} ` : ''}Option Routes`),
  )
}
