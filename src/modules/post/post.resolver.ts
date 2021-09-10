import { NotFoundException } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { IsMaster } from '~/common/decorator/role.decorator'
import { UpdateDocumentCount } from '~/common/decorator/update-count.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'
import {
  addConditionToSeeHideContent,
  addYearCondition,
} from '~/utils/query.util'
import { transformDataToPaginate } from '~/utils/transfrom.util'
import { CategoryAndSlugDto, PostQueryDto } from './post.dto'
import { PostModel, PostPaginatorModel } from './post.model'
import { PostService } from './post.service'

@Resolver()
export class PostResolver {
  constructor(private readonly postService: PostService) {}

  @Query(() => PostModel)
  @UpdateDocumentCount('Post')
  public async getPostById(
    @Args() { id }: MongoIdDto,
    @IsMaster() isMaster: boolean,
  ) {
    return this.postService.model
      .findOne({ _id: id, ...addConditionToSeeHideContent(isMaster) })
      .populate('category')
  }

  @Query(() => PostPaginatorModel)
  public async getPostList(
    @IsMaster() isMaster: boolean,
    @Args() args: PostQueryDto,
  ) {
    const { size, select, page, year, sortBy, sortOrder } = args

    const res = await this.postService.findWithPaginator(
      {
        ...addYearCondition(year),
        ...addConditionToSeeHideContent(isMaster),
      },
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
        populate: 'category',
      },
    )

    return transformDataToPaginate(res)
  }

  @Query(() => PostModel)
  @UpdateDocumentCount('Post')
  async getByCateAndSlug(
    @Args() args: CategoryAndSlugDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { category, slug } = args

    const categoryDocument = await this.postService.getCategoryBySlug(category)
    if (!categoryDocument) {
      throw new NotFoundException('该分类未找到 (｡•́︿•̀｡)')
    }

    const postDocument = await this.postService.model
      .findOne({
        slug,
        categoryId: categoryDocument._id,
      })
      .populate('category')

    if (!postDocument || (postDocument.hide && !isMaster)) {
      throw new CannotFindException()
    }
    return postDocument
  }
}
