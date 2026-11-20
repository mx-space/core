import { CollectionRefTypes as ServerCollectionRefTypes } from '@mx-space/db-schema'
import { describe, expect, it } from 'vitest'

import { CollectionRefTypes } from '../models/ref-types'

describe('CollectionRefTypes mirror', () => {
  it('matches the @mx-space/db-schema enum', () => {
    expect(CollectionRefTypes).toEqual(ServerCollectionRefTypes)
  })
})
