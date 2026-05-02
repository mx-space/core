import { Injectable } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import type { ReaderModel } from './reader.model'
import { ReaderRepository, type ReaderRow } from './reader.repository'

type LegacyReaderId = {
  toHexString: () => string
  toString: () => string
}

type LegacyReader = ReaderModel & {
  _id: LegacyReaderId
  id: string
  email: string | null
  name: string | null
  handle: string | null
  image: string | null
  role: 'reader' | 'owner'
  username: string | null
  displayUsername: string | null
  createdAt: Date
  updatedAt: Date | null
}

@Injectable()
export class ReaderService {
  constructor(
    private readonly authService: AuthService,
    private readonly readerRepository: ReaderRepository,
  ) {}

  private toLegacyReader(row: ReaderRow): LegacyReader {
    const id = {
      toHexString: () => row.id,
      toString: () => row.id,
    }
    return {
      ...row,
      _id: id,
      id: row.id,
      role: row.role as 'reader' | 'owner',
    } as LegacyReader
  }

  find() {
    return this.readerRepository
      .list(1, 100)
      .then((result) => result.data.map((row) => this.toLegacyReader(row)))
  }

  async findPaginated(page: number, size: number) {
    const result = await this.readerRepository.list(page, size)

    return {
      docs: result.data.map((row) => this.toLegacyReader(row)),
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      limit: result.pagination.size,
      totalPages: result.pagination.totalPage,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  }
  async transferOwner(id: string) {
    return this.authService.transferOwnerRole(id)
  }
  async revokeOwner(id: string) {
    return this.authService.revokeOwnerRole(id)
  }
  async findReaderInIds(ids: string[]) {
    const rows = await this.readerRepository.findByIds(ids)
    return rows.map((row) => this.toLegacyReader(row))
  }
}
