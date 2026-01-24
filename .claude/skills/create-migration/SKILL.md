---
name: create-migration
description: Create database migration file. Use when modifying database structure, migrating data, or updating config formats.
argument-hint: <version> <description>
disable-model-invocation: true
---

# Create Database Migration

Create a new database migration file. Arguments: `$ARGUMENTS`

## Migration File Location

Create migration file under `apps/core/src/migration/version/`.

Naming format: `v<major>.<minor>.<patch>.ts` (e.g., `v9.1.0.ts`)

## Migration File Template

```typescript
import type { Db } from 'mongodb'

/**
 * Migration description: <describe the purpose of this migration>
 *
 * Changes:
 * - <list specific changes>
 */
export default async function v<version>(db: Db) {
  // 1. Check if migration is needed
  const existingData = await db.collection('<collection>').findOne({
    // query conditions
  })

  if (!existingData) {
    return // No migration needed
  }

  // 2. Check if already migrated
  if (existingData.newField !== undefined) {
    return // Already migrated
  }

  // 3. Execute migration
  await db.collection('<collection>').updateMany(
    { /* query conditions */ },
    { $set: { /* update content */ } },
  )

  // Or batch update
  const cursor = db.collection('<collection>').find({})
  for await (const doc of cursor) {
    await db.collection('<collection>').updateOne(
      { _id: doc._id },
      { $set: { /* update content */ } },
    )
  }
}
```

## Common Migration Scenarios

### 1. Rename Field

```typescript
export default async function v910(db: Db) {
  await db.collection('posts').updateMany(
    { oldFieldName: { $exists: true } },
    { $rename: { oldFieldName: 'newFieldName' } },
  )
}
```

### 2. Add Default Value

```typescript
export default async function v910(db: Db) {
  await db.collection('posts').updateMany(
    { newField: { $exists: false } },
    { $set: { newField: 'defaultValue' } },
  )
}
```

### 3. Data Format Transformation

```typescript
export default async function v910(db: Db) {
  const cursor = db.collection('options').find({ name: 'config' })

  for await (const doc of cursor) {
    const { oldFormat, ...rest } = doc.value

    const newValue = {
      ...rest,
      newFormat: transformData(oldFormat),
    }

    await db.collection('options').updateOne(
      { _id: doc._id },
      { $set: { value: newValue } },
    )
  }
}
```

### 4. Remove Field

```typescript
export default async function v910(db: Db) {
  await db.collection('users').updateMany(
    {},
    { $unset: { deprecatedField: '' } },
  )
}
```

### 5. Create Index

```typescript
export default async function v910(db: Db) {
  await db.collection('posts').createIndex(
    { slug: 1 },
    { unique: true },
  )
}
```

## Register Migration

Add migration in `apps/core/src/migration/history.ts`:

```typescript
import v910 from './version/v9.1.0'

export const VersionList = [
  // ... other migrations
  { name: 'v9.1.0', run: v910 },
]
```

## Migration Execution

Migrations run automatically on application startup. Executed migrations are recorded in `mx_migration` collection and won't run again.

## Testing Migration

Create test file: `apps/core/test/src/migration/v<version>.spec.ts`

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Db } from 'mongodb'
import v910 from '~/migration/version/v9.1.0'
import { dbHelper } from 'test/helper/db-mock.helper'

describe('Migration v9.1.0', () => {
  let db: Db

  beforeAll(async () => {
    const connection = await dbHelper.connect()
    db = connection.connection.db!
  })

  afterAll(async () => {
    await dbHelper.close()
  })

  it('should migrate old format to new format', async () => {
    // Insert old format data
    await db.collection('test').insertOne({
      oldField: 'value',
    })

    // Execute migration
    await v910(db)

    // Verify result
    const result = await db.collection('test').findOne({})
    expect(result).toMatchObject({
      newField: 'transformedValue',
    })
    expect(result!.oldField).toBeUndefined()
  })

  it('should skip if already migrated', async () => {
    // Insert new format data
    await db.collection('test').insertOne({
      newField: 'value',
    })

    // Migration should not error
    await v910(db)

    // Data should remain unchanged
    const result = await db.collection('test').findOne({})
    expect(result!.newField).toBe('value')
  })
})
```

## Notes

1. Migrations should be idempotent (can be run repeatedly without side effects)
2. Check if migration is needed first to avoid unnecessary operations
3. Use cursor for large datasets to avoid memory overflow
4. Failed migrations throw exceptions and prevent app startup
5. Backup data before running migrations in production
