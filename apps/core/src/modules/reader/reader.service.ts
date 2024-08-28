import type { DatabaseService } from '~/processors/database/database.service'

export class ReaderService {
  constructor(private readonly databaseService: DatabaseService) {}
}
