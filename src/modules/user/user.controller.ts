import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('User Routes')
@Controller(['user', 'master'])
export class UserController {}
