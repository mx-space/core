import { Module } from '@nestjs/common'

import { DRAFT_SERVICE_TOKEN } from '~/constants/injection.constant'

import { CollabController } from './collab.controller'
import { CollabRepository } from './collab.repository'
import { CollabService } from './collab.service'
import { CollabRoomService } from './collab-room.service'
import {
  collabAccessProvider,
  collabRelayProvider,
  CollabRoomWsHandler,
} from './collab-room.ws'
import { DraftController } from './draft.controller'
import { DraftRepository } from './draft.repository'
import { DraftService } from './draft.service'
import { DraftCleanupController } from './draft-cleanup.controller'
import { DraftCleanupRepository } from './draft-cleanup.repository'
import { DraftCleanupService } from './draft-cleanup.service'
import { DraftCrdtRepository } from './draft-crdt.repository'
import { DraftCrdtService } from './draft-crdt.service'
import { DraftOrganizerRepository } from './draft-organizer.repository'
import { DraftStorageRepository } from './draft-storage.repository'

@Module({
  controllers: [DraftController, DraftCleanupController, CollabController],
  providers: [
    DraftRepository,
    DraftCrdtRepository,
    DraftCrdtService,
    DraftCleanupRepository,
    DraftStorageRepository,
    DraftOrganizerRepository,
    DraftCleanupService,
    DraftService,
    CollabRepository,
    CollabService,
    CollabRoomService,
    CollabRoomWsHandler,
    collabRelayProvider,
    collabAccessProvider,
    { provide: DRAFT_SERVICE_TOKEN, useExisting: DraftService },
  ],
  exports: [
    CollabRepository,
    DraftCleanupService,
    DraftService,
    DraftRepository,
    DRAFT_SERVICE_TOKEN,
  ],
})
export class DraftModule {}
