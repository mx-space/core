---
name: create-module
description: Create a new NestJS module with controller, service, model, and schema files. Use when adding new feature modules, API endpoints, or business domains.
argument-hint: <module-name>
disable-model-invocation: true
---

# Create NestJS Module

Create a new NestJS module for MX Space project. Module name: `$ARGUMENTS`

## Directory Structure

Create the following files under `apps/core/src/modules/<module-name>/`:

```
<module-name>/
├── <name>.module.ts      # Module definition
├── <name>.controller.ts  # HTTP controller
├── <name>.service.ts     # Business logic
├── <name>.model.ts       # TypeGoose data model
├── <name>.schema.ts      # Zod validation schema
└── <name>.type.ts        # TypeScript types (optional)
```

## File Templates

### 1. Module (`<name>.module.ts`)

```typescript
import { Module } from '@nestjs/common'
import { <Name>Controller } from './<name>.controller'
import { <Name>Service } from './<name>.service'

@Module({
  controllers: [<Name>Controller],
  providers: [<Name>Service],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

### 2. Model (`<name>.model.ts`)

```typescript
import { modelOptions, prop, Severity } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

export const <NAME>_COLLECTION_NAME = '<name>s'

@modelOptions({
  options: {
    customName: <NAME>_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
export class <Name>Model extends BaseModel {
  @prop({ required: true })
  name!: string

  // Add other fields...
}
```

### 3. Schema (`<name>.schema.ts`)

```typescript
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

export const <Name>Schema = z.object({
  name: z.string().min(1),
  // Add other fields...
})

export class <Name>Dto extends createZodDto(<Name>Schema) {}
export class Partial<Name>Dto extends createZodDto(<Name>Schema.partial()) {}
```

### 4. Service (`<name>.service.ts`)

```typescript
import { Injectable } from '@nestjs/common'
import { InjectModel } from '~/transformers/model.transformer'
import { <Name>Model } from './<name>.model'
import type { ReturnModelType } from '@typegoose/typegoose'

@Injectable()
export class <Name>Service {
  constructor(
    @InjectModel(<Name>Model)
    private readonly <name>Model: ReturnModelType<typeof <Name>Model>,
  ) {}

  get model() {
    return this.<name>Model
  }

  async create(data: Partial<<Name>Model>) {
    return this.model.create(data)
  }

  async findById(id: string) {
    return this.model.findById(id).lean()
  }

  async findAll() {
    return this.model.find().lean()
  }

  async updateById(id: string, data: Partial<<Name>Model>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).lean()
  }

  async deleteById(id: string) {
    return this.model.findByIdAndDelete(id)
  }
}
```

### 5. Controller (`<name>.controller.ts`)

```typescript
import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { <Name>Service } from './<name>.service'
import { <Name>Dto, Partial<Name>Dto } from './<name>.schema'

@ApiController('<name>s')
export class <Name>Controller {
  constructor(private readonly <name>Service: <Name>Service) {}

  @Get('/')
  @HTTPDecorators.Paginator
  async getPaginate(@Query() query: PagerDto) {
    const { page, size } = query
    return this.<name>Service.model.paginate(
      {},
      { page, limit: size, sort: { created: -1 } },
    )
  }

  @Get('/:id')
  async getById(@Param() params: MongoIdDto) {
    return this.<name>Service.findById(params.id)
  }

  @Post('/')
  @Auth()
  async create(@Body() body: <Name>Dto) {
    return this.<name>Service.create(body)
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: MongoIdDto, @Body() body: Partial<Name>Dto) {
    return this.<name>Service.updateById(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() params: MongoIdDto) {
    await this.<name>Service.deleteById(params.id)
  }
}
```

## Register Module

After creating files, register the module in `apps/core/src/app.module.ts`:

1. Add import statement
2. Add module to `imports` array

## Register Data Model

Add model in `apps/core/src/processors/database/database.models.ts`:

```typescript
import { <Name>Model } from '~/modules/<name>/<name>.model'

export const databaseModels = [
  // ... other models
  <Name>Model,
]
```

## Project Conventions

- Use `@ApiController()` instead of `@Controller()`
- Use Zod schema for validation, not class-validator
- Models extend from `BaseModel` or `WriteBaseModel`
- Use `lean()` for plain objects (performance optimization)
- Use `@Auth()` decorator for authenticated endpoints
- Use `@HTTPDecorators.Paginator` for paginated endpoints
