import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator'
import {
  SyncableCollectionName,
  SyncableCollectionNames,
} from './sync.constant'

export class SyncByLastSyncedAtDto {
  @IsDateString()
  lastSyncedAt: string
}

export class SyncDataChecksumDto {
  @IsOptional()
  @IsString()
  checksum?: string

  @IsEnum(SyncableCollectionNames)
  type: SyncableCollectionName

  @IsMongoId()
  id: string
}
