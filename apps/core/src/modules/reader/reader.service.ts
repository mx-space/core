import { Injectable } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import { ReaderRepository } from './reader.repository'
import type { ReaderModel, ReaderRow } from './reader.types'

type ReaderShape = ReaderModel & {
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

  private toReaderShape(row: ReaderRow): ReaderShape {
    return {
      ...row,
      id: row.id,
      role: row.role as 'reader' | 'owner',
    } as ReaderShape
  }

  async find() {
    const result = await this.readerRepository.list(1, 100)
    return result.data.map((row) => this.toReaderShape(row))
  }

  async findPaginated(page: number, size: number) {
    const result = await this.readerRepository.list(page, size)

    return {
      docs: result.data.map((row) => this.toReaderShape(row)),
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
    return rows.map((row) => this.toReaderShape(row))
  }
}
