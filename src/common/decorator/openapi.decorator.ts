import { ApiTags } from '@nestjs/swagger'

export const ApiName: ClassDecorator = (target) => {
  const [name] = target.name.split('Controller')
  ApiTags(name + ' Routes').call(null, target)
}
