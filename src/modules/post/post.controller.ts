import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('posts')
@ApiTags('Post Routes')
export class PostController {}
