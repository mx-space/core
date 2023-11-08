import { IsDateString } from 'class-validator'

export class SyncByLastSyncedAtDto {
  @IsDateString()
  lastSyncedAt: string
}
