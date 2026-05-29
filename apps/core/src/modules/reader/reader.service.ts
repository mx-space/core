import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

import { AuthService } from '../auth/auth.service'
import type { ReaderRoleFilter } from './reader.repository'
import { ReaderRepository } from './reader.repository'
import type { ReaderModel, ReaderRow } from './reader.types'

type ReaderShape = ReaderModel & {
  id: string
  email: string | null
  emailVerified: boolean
  name: string | null
  handle: string | null
  image: string | null
  role: 'reader' | 'owner'
  username: string | null
  displayUsername: string | null
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
  updatedAt: Date | null
  lastLoginAt: Date | null
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
      role: row.role as 'reader' | 'owner',
      bannedAt: row.bannedAt ?? null,
      banReason: row.banReason ?? null,
      lastLoginAt: row.lastLoginAt ?? null,
    } as ReaderShape
  }

  async find() {
    const result = await this.readerRepository.list({ page: 1, size: 100 })
    return result.data.map((row) => this.toReaderShape(row))
  }

  async findPaginated(
    page: number,
    size: number,
    search?: string,
    role?: ReaderRoleFilter,
  ) {
    const result = await this.readerRepository.list({
      page,
      size,
      search,
      role,
    })

    return {
      data: result.data.map((row) => this.toReaderShape(row)),
      pagination: result.pagination,
    }
  }

  async getById(id: string) {
    const row = await this.readerRepository.findByIdDetailed(id)
    if (!row) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }
    return this.toReaderShape(row)
  }

  async getStats() {
    return this.readerRepository.countByRole()
  }

  async banReader(id: string, reason?: string) {
    const reader = await this.readerRepository.findByIdDetailed(id)
    if (!reader) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }
    if (reader.role === 'owner') {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'cannot ban owner',
      })
    }
    await this.readerRepository.setBanned(id, {
      bannedAt: new Date(),
      banReason: reason ?? null,
    })
    await this.readerRepository.deleteSessionsForUser(id)
    return this.getById(id)
  }

  async unbanReader(id: string) {
    const reader = await this.readerRepository.findByIdDetailed(id)
    if (!reader) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }
    await this.readerRepository.unsetBanned(id)
    return this.getById(id)
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
