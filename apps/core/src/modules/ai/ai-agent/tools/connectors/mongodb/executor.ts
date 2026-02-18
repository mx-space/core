import { Type, type Static } from '@mariozechner/pi-ai'
import type { Db, Filter } from 'mongodb'
import type { AIAgentToolResult } from '../../../ai-agent.types'

export const MONGO_TOOL_OPERATIONS = [
  'find',
  'findOne',
  'countDocuments',
  'distinct',
  'aggregate',
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'bulkWrite',
] as const

export const MongoToolParameters = Type.Object({
  collection: Type.String({ minLength: 1 }),
  operation: Type.String({
    enum: [...MONGO_TOOL_OPERATIONS],
  }),
  filter: Type.Optional(Type.Object({}, { additionalProperties: true })),
  update: Type.Optional(Type.Object({}, { additionalProperties: true })),
  document: Type.Optional(Type.Object({}, { additionalProperties: true })),
  documents: Type.Optional(
    Type.Array(Type.Object({}, { additionalProperties: true })),
  ),
  options: Type.Optional(Type.Object({}, { additionalProperties: true })),
  pipeline: Type.Optional(
    Type.Array(Type.Object({}, { additionalProperties: true })),
  ),
  field: Type.Optional(Type.String()),
})

export type MongoToolArgs = Static<typeof MongoToolParameters>

const MONGO_WRITE_OPERATIONS = new Set([
  'insertone',
  'insertmany',
  'updateone',
  'updatemany',
  'replaceone',
  'deleteone',
  'deletemany',
  'findoneandupdate',
  'findoneandreplace',
  'findoneanddelete',
  'bulkwrite',
])

const MONGO_READ_OPERATIONS = new Set([
  'find',
  'findone',
  'countdocuments',
  'distinct',
  'aggregate',
])

export function normalizeMongoOperation(operation: string) {
  return operation.trim().toLowerCase()
}

export function isMongoWriteOperation(operation: string) {
  return MONGO_WRITE_OPERATIONS.has(operation.toLowerCase())
}

export function isMongoReadOperation(operation: string) {
  return MONGO_READ_OPERATIONS.has(operation.toLowerCase())
}

interface ExecuteMongoToolContext {
  db: Db
  sessionId: string
  seq: { value: number }
  params: MongoToolArgs
  safeJson: (input: unknown) => string
  createPendingAction: (
    sessionId: string,
    seq: { value: number },
    toolName: string,
    args: Record<string, unknown>,
    dryRunPreview: Record<string, unknown>,
  ) => Promise<{ id: string }>
}

export async function executeMongoTool(
  context: ExecuteMongoToolContext,
): Promise<AIAgentToolResult> {
  const operation = normalizeMongoOperation(context.params.operation)

  if (isMongoReadOperation(operation)) {
    const result = await executeMongoReadOperation(context.db, context.params)
    return {
      content: [
        {
          type: 'text' as const,
          text: context.safeJson(result),
        },
      ],
      details: {
        collection: context.params.collection,
        operation: context.params.operation,
        result,
      },
    }
  }

  if (isMongoWriteOperation(operation)) {
    const dryRunPreview = await buildMongoDryRunPreview(
      context.db,
      context.params,
    )
    const action = await context.createPendingAction(
      context.sessionId,
      context.seq,
      'mongodb',
      {
        ...context.params,
        operation,
      },
      dryRunPreview,
    )

    return {
      content: [
        {
          type: 'text' as const,
          text: `MongoDB write requires confirmation. actionId=${action.id}`,
        },
      ],
      details: {
        pendingConfirmation: true,
        actionId: action.id,
        dryRunPreview,
      },
    }
  }

  throw new Error(`Unsupported MongoDB operation: ${context.params.operation}`)
}

export async function executeMongoConfirmedAction(
  db: Db,
  params: Record<string, unknown>,
) {
  const args = params as unknown as MongoToolArgs
  const collection = db.collection(args.collection)
  const operation = normalizeMongoOperation(args.operation)

  switch (operation) {
    case 'insertone': {
      const result = await collection.insertOne((args.document || {}) as any, {
        ...args.options,
      })
      return {
        acknowledged: result.acknowledged,
        insertedId: result.insertedId,
      }
    }
    case 'insertmany': {
      const result = await collection.insertMany(
        (args.documents || []) as any[],
        {
          ...args.options,
        },
      )
      return {
        acknowledged: result.acknowledged,
        insertedCount: result.insertedCount,
        insertedIds: result.insertedIds,
      }
    }
    case 'updateone': {
      const result = await collection.updateOne(
        (args.filter || {}) as Filter<any>,
        (args.update || {}) as any,
        args.options || {},
      )
      return {
        acknowledged: result.acknowledged,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId,
      }
    }
    case 'updatemany': {
      const result = await collection.updateMany(
        (args.filter || {}) as Filter<any>,
        (args.update || {}) as any,
        args.options || {},
      )
      return {
        acknowledged: result.acknowledged,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId,
      }
    }
    case 'replaceone': {
      const result = await collection.replaceOne(
        (args.filter || {}) as Filter<any>,
        (args.document || {}) as any,
        args.options || {},
      )
      return {
        acknowledged: result.acknowledged,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId,
      }
    }
    case 'deleteone': {
      const result = await collection.deleteOne(
        (args.filter || {}) as Filter<any>,
        args.options || {},
      )
      return {
        acknowledged: result.acknowledged,
        deletedCount: result.deletedCount,
      }
    }
    case 'deletemany': {
      const result = await collection.deleteMany(
        (args.filter || {}) as Filter<any>,
        args.options || {},
      )
      return {
        acknowledged: result.acknowledged,
        deletedCount: result.deletedCount,
      }
    }
    case 'findoneandupdate': {
      const result = await collection.findOneAndUpdate(
        (args.filter || {}) as Filter<any>,
        (args.update || {}) as any,
        args.options || {},
      )
      return {
        data: result,
      }
    }
    case 'findoneandreplace': {
      const result = await collection.findOneAndReplace(
        (args.filter || {}) as Filter<any>,
        (args.document || {}) as any,
        args.options || {},
      )
      return {
        data: result,
      }
    }
    case 'findoneanddelete': {
      const result = await collection.findOneAndDelete(
        (args.filter || {}) as Filter<any>,
        args.options || {},
      )
      return {
        data: result,
      }
    }
    case 'bulkwrite': {
      const operations = (args.options as any)?.operations
      if (!Array.isArray(operations)) {
        throw new Error('bulkWrite requires options.operations array')
      }
      const result = await collection.bulkWrite(operations)
      return {
        acknowledged: result.isOk(),
        insertedCount: result.insertedCount,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount,
        upsertedCount: result.upsertedCount,
      }
    }
    default: {
      throw new Error(`Unsupported MongoDB write operation: ${args.operation}`)
    }
  }
}

async function executeMongoReadOperation(db: Db, params: MongoToolArgs) {
  const collection = db.collection(params.collection)
  const operation = normalizeMongoOperation(params.operation)

  switch (operation) {
    case 'find': {
      const data = await collection
        .find((params.filter || {}) as Filter<any>, params.options || {})
        .limit(Math.min(Number((params.options as any)?.limit || 20), 100))
        .toArray()
      return { data }
    }
    case 'findone': {
      const data = await collection.findOne(
        (params.filter || {}) as Filter<any>,
        params.options || {},
      )
      return { data }
    }
    case 'countdocuments': {
      const count = await collection.countDocuments(
        (params.filter || {}) as Filter<any>,
        params.options || {},
      )
      return { count }
    }
    case 'distinct': {
      if (!params.field) {
        throw new Error('field is required for distinct')
      }
      const data = await collection.distinct(
        params.field,
        (params.filter || {}) as Filter<any>,
        params.options || {},
      )
      return { data }
    }
    case 'aggregate': {
      const data = await collection
        .aggregate(params.pipeline || [], params.options || {})
        .limit(Math.min(Number((params.options as any)?.limit || 20), 100))
        .toArray()
      return { data }
    }
    default: {
      throw new Error(`Unsupported MongoDB read operation: ${params.operation}`)
    }
  }
}

async function buildMongoDryRunPreview(db: Db, params: MongoToolArgs) {
  const collection = db.collection(params.collection)
  const operation = normalizeMongoOperation(params.operation)

  const preview: Record<string, unknown> = {
    collection: params.collection,
    operation: params.operation,
    filter: params.filter || {},
    update: params.update,
    options: params.options,
  }

  if (
    operation === 'updateone' ||
    operation === 'updatemany' ||
    operation === 'deleteone' ||
    operation === 'deletemany' ||
    operation === 'replaceone' ||
    operation === 'findoneandupdate' ||
    operation === 'findoneandreplace' ||
    operation === 'findoneanddelete'
  ) {
    preview.estimatedMatchedCount = await collection.countDocuments(
      (params.filter || {}) as Filter<any>,
    )
  }

  if (operation === 'insertone') {
    preview.estimatedInsertCount = params.document ? 1 : 0
    preview.document = params.document
  }

  if (operation === 'insertmany') {
    preview.estimatedInsertCount = params.documents?.length || 0
    preview.documentsSample = (params.documents || []).slice(0, 3)
  }

  if (operation === 'bulkwrite') {
    const operations = (params.options as any)?.operations
    preview.bulkOperationCount = Array.isArray(operations)
      ? operations.length
      : undefined
    preview.operationsSample = Array.isArray(operations)
      ? operations.slice(0, 3)
      : undefined
  }

  return preview
}
