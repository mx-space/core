import { Body, Controller, Param, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Types } from 'mongoose'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PostModel } from './post.model'
import { PostService } from './post.service'

@Controller('posts')
@ApiTags('Post Routes')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('/')
  async create(@Body() body: PostModel) {
    const _id = Types.ObjectId()

    return await this.postService.create({
      ...body,
      slug: body.slug ?? _id.toHexString(),
    })
  }
  @Put('/:id')
  async update(@Param() params: MongoIdDto) {}
}
