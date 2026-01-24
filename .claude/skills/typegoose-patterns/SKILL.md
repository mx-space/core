---
name: typegoose-patterns
description: MX Space project TypeGoose model patterns. Apply when creating data models, defining schemas, or handling MongoDB operations.
user-invocable: false
---

# TypeGoose Model Patterns

## Basic Model

```typescript
import { modelOptions, prop, Severity, index } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

export const MY_COLLECTION_NAME = 'my_items'

@modelOptions({
  options: {
    customName: MY_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
export class MyModel extends BaseModel {
  @prop({ required: true })
  name!: string

  @prop()
  description?: string
}
```

## Base Model Inheritance

```typescript
// BaseModel - Base fields
// Includes: _id, created, updated

// WriteBaseModel - Content models
// Includes: title, text, images, meta, modified
export class PostModel extends WriteBaseModel {
  // Additional fields
}

// BaseCommentIndexModel - Supports comments
// Includes: commentsIndex, allowComment
```

## Field Decorators

### Basic Fields

```typescript
@prop({ required: true })        // Required
name!: string

@prop()                          // Optional
description?: string

@prop({ default: true })         // Default value
isPublished: boolean

@prop({ unique: true })          // Unique constraint
slug!: string

@prop({ trim: true })            // Auto trim
title!: string
```

### Indexes

```typescript
// Single field index
@prop({ index: true })
slug!: string

// Class-level indexes
@index({ slug: 1 })
@index({ created: -1 })
@index({ title: 'text', text: 'text' })  // Text index
export class MyModel extends BaseModel {}
```

### References

```typescript
import { Ref } from '@typegoose/typegoose'
import { Category } from '~/modules/category/category.model'

// Reference field
@prop({ ref: () => Category, required: true })
categoryId: Ref<Category>

// Auto-populated virtual field
@prop({
  ref: () => Category,
  foreignField: '_id',
  localField: 'categoryId',
  justOne: true,
  autopopulate: true,
})
public category: Ref<Category>
```

### Nested Objects

```typescript
// Define subdocument class
class Count {
  @prop({ default: 0 })
  read: number

  @prop({ default: 0 })
  like: number
}

// Usage
@prop({ type: Count, default: { read: 0, like: 0 }, _id: false })
count: Count
```

### Arrays

```typescript
@prop({ type: () => [String] })
tags?: string[]

@prop({ type: () => [ImageModel] })
images?: ImageModel[]
```

## Plugins

```typescript
import { plugin } from '@typegoose/typegoose'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import autoPopulate from 'mongoose-autopopulate'

@plugin(mongoosePaginate)      // Pagination
@plugin(aggregatePaginate)     // Aggregate pagination
@plugin(autoPopulate)          // Auto populate
export class MyModel extends BaseModel {}
```

## Protected Keys

```typescript
export class MyModel extends BaseModel {
  @prop()
  secret?: string

  // Define fields that should not be directly updated
  static get protectedKeys() {
    return ['secret'].concat(super.protectedKeys)
  }
}
```

## Model Registration

In `apps/core/src/processors/database/database.models.ts`:

```typescript
import { MyModel } from '~/modules/my/my.model'

export const databaseModels = [
  // ...
  MyModel,
]
```

## Usage in Services

```typescript
import { InjectModel } from '~/transformers/model.transformer'
import type { ReturnModelType } from '@typegoose/typegoose'
import type { AggregatePaginateModel } from '~/shared/types/mongoose.types'

@Injectable()
export class MyService {
  constructor(
    @InjectModel(MyModel)
    private readonly model: ReturnModelType<typeof MyModel> &
      AggregatePaginateModel<MyModel>,
  ) {}

  // Query - use lean() to return plain object
  async findById(id: string) {
    return this.model.findById(id).lean()
  }

  // Pagination
  async paginate(page: number, size: number) {
    return this.model.paginate({}, { page, limit: size })
  }

  // Aggregate pagination
  async aggregatePaginate(pipeline: any[], page: number, size: number) {
    const aggregate = this.model.aggregate(pipeline)
    return this.model.aggregatePaginate(aggregate, { page, limit: size })
  }
}
```

## Common Query Patterns

```typescript
// Conditional query
await this.model.find({ isPublished: true }).lean()

// Sorting
await this.model.find().sort({ created: -1 }).lean()

// Field selection
await this.model.find().select('title slug').lean()

// Population
await this.model.find().populate('category').lean()

// Count
await this.model.countDocuments({ isPublished: true })

// Update
await this.model.findByIdAndUpdate(id, data, { new: true }).lean()

// Delete
await this.model.findByIdAndDelete(id)
```
