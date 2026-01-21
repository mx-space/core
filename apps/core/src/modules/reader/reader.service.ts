import { Injectable } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'
import { DatabaseService } from '~/processors/database/database.service'
import { InjectModel } from '~/transformers/model.transformer'
import { Document } from 'mongodb'
import { Types } from 'mongoose'
import { AUTH_JS_USER_COLLECTION } from '../auth/auth.constant'
import { ReaderModel } from './reader.model'

@Injectable()
export class ReaderService {
  constructor(
    private readonly databaseService: DatabaseService,
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
      {
        // flat account array
        $unwind: '$account',
      },

      {
        $project: {
          _id: 1,
          email: 1,
          isOwner: 1,
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

      // account field flat to root level
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
      .collection(AUTH_JS_USER_COLLECTION)
      .aggregate(this.buildQueryPipeline())
      .toArray()
  }

  async findPaginated(page: number, size: number) {
    const skip = (page - 1) * size
    const collection = this.databaseService.db.collection(
      AUTH_JS_USER_COLLECTION,
    )

    const pipeline = this.buildQueryPipeline()

    // Get total count (unique users, not accounts)
    const totalDocs = await collection.countDocuments()

    // Add pagination to pipeline
    const paginatedPipeline = [...pipeline, { $skip: skip }, { $limit: size }]

    const docs = await collection.aggregate(paginatedPipeline).toArray()

    const totalPages = Math.ceil(totalDocs / size)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    // Return mongoose PaginateResult compatible format
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
  async updateAsOwner(id: string) {
    return this.databaseService.db
      .collection(AUTH_JS_USER_COLLECTION)
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { isOwner: true } })
  }
  async revokeOwner(id: string) {
    return this.databaseService.db
      .collection(AUTH_JS_USER_COLLECTION)
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { isOwner: false } })
  }
  async findReaderInIds(ids: string[]) {
    return this.readerModel
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      })
      .lean()
  }
}
