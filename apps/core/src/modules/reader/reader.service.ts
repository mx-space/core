import { Injectable } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'
import { READER_COLLECTION_NAME } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { InjectModel } from '~/transformers/model.transformer'
import type { Document } from 'mongodb'
import { Types } from 'mongoose'
import { AuthService } from '../auth/auth.service'
import { ReaderModel } from './reader.model'

@Injectable()
export class ReaderService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService,
    @InjectModel(ReaderModel)
    private readonly readerModel: ReturnModelType<typeof ReaderModel>,
  ) {}

  private buildQueryPipeline(where?: Record<string, any>): Document[] {
    const basePipeline: Document[] = [
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: 'userId',
          as: 'account',
        },
      },
      { $unwind: '$account' },
      {
        $project: {
          _id: 1,
          email: 1,
          role: 1,
          image: 1,
          name: 1,
          handle: 1,
          account: {
            _id: 1,
            type: 1,
            provider: 1,
          },
        },
      },

      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$account', '$$ROOT'],
          },
        },
      },
      {
        $project: {
          account: 0,
        },
      },
    ]

    if (where) {
      basePipeline.push({
        $match: where,
      })
    }
    return basePipeline
  }
  find() {
    return this.databaseService.db
      .collection(READER_COLLECTION_NAME)
      .aggregate(this.buildQueryPipeline())
      .toArray()
  }

  async findPaginated(page: number, size: number) {
    const skip = (page - 1) * size
    const collection = this.databaseService.db.collection(
      READER_COLLECTION_NAME,
    )

    const pipeline = this.buildQueryPipeline()

    const totalDocs = await collection.countDocuments()
    const paginatedPipeline = [...pipeline, { $skip: skip }, { $limit: size }]

    const docs = await collection.aggregate(paginatedPipeline).toArray()

    const totalPages = Math.ceil(totalDocs / size)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return {
      docs,
      totalDocs,
      page,
      limit: size,
      totalPages,
      hasNextPage,
      hasPrevPage,
    }
  }
  async transferOwner(id: string) {
    return this.authService.transferOwnerRole(id)
  }
  async revokeOwner(id: string) {
    return this.authService.revokeOwnerRole(id)
  }
  async findReaderInIds(ids: string[]) {
    return this.readerModel
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      })
      .lean()
  }
}
