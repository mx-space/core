import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { WithFastifyRouteOptions } from '~/common/decorators/fastify-route-options.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { ReaderAuth } from '~/common/decorators/reader-auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'

import {
  type CollabCollaboratorParamsDto,
  CollabCollaboratorParamsSchema,
  type CollabCrdtQueryDto,
  CollabCrdtQuerySchema,
  type CollabDocumentParamsDto,
  CollabDocumentParamsSchema,
  type CollabInviteParamsDto,
  CollabInviteParamsSchema,
  type CollabTokenParamsDto,
  CollabTokenParamsSchema,
  type CreateCollabInviteDto,
  CreateCollabInviteSchema,
  type UpdateCollaboratorDto,
  UpdateCollaboratorSchema,
} from './collab.schema'
import { CollabService } from './collab.service'

const CRDT_UPDATE_BODY_LIMIT = 4 * 1024 * 1024

@ApiController('collab')
export class CollabController {
  constructor(private readonly collab: CollabService) {}

  @Get('/documents/:documentId/invites')
  @Auth()
  listInvites(
    @Param({ schema: CollabDocumentParamsSchema })
    params: CollabDocumentParamsDto,
  ) {
    return this.collab.listInvites(params.documentId)
  }

  @Post('/documents/:documentId/invites')
  @Auth()
  createInvite(
    @Param({ schema: CollabDocumentParamsSchema })
    params: CollabDocumentParamsDto,
    @Body({ schema: CreateCollabInviteSchema }) body: CreateCollabInviteDto,
  ) {
    return this.collab.createInvite(params.documentId, body)
  }

  @Delete('/documents/:documentId/invites/:inviteId')
  @Auth()
  @HttpCode(204)
  async revokeInvite(
    @Param({ schema: CollabInviteParamsSchema }) params: CollabInviteParamsDto,
  ) {
    await this.collab.revokeInvite(params.documentId, params.inviteId)
  }

  @Get('/documents/:documentId/collaborators')
  @Auth()
  listCollaborators(
    @Param({ schema: CollabDocumentParamsSchema })
    params: CollabDocumentParamsDto,
  ) {
    return this.collab.listCollaborators(params.documentId)
  }

  @Patch('/documents/:documentId/collaborators/:readerId')
  @Auth()
  @HttpCode(204)
  async updateCollaborator(
    @Param({ schema: CollabCollaboratorParamsSchema })
    params: CollabCollaboratorParamsDto,
    @Body({ schema: UpdateCollaboratorSchema }) body: UpdateCollaboratorDto,
  ) {
    await this.collab.setShowInByline(
      params.documentId,
      params.readerId,
      body.showInByline,
    )
  }

  @Delete('/documents/:documentId/collaborators/:readerId')
  @Auth()
  @HttpCode(204)
  async removeCollaborator(
    @Param({ schema: CollabCollaboratorParamsSchema })
    params: CollabCollaboratorParamsDto,
  ) {
    await this.collab.removeCollaborator(params.documentId, params.readerId)
  }

  @Post('/invites/:token/accept')
  @ReaderAuth()
  accept(
    @Param({ schema: CollabTokenParamsSchema }) params: CollabTokenParamsDto,
    @CurrentReaderId() readerId: string,
  ) {
    return this.collab.accept(params.token, readerId)
  }

  @Get('/documents/:documentId')
  @ReaderAuth()
  workspace(
    @Param({ schema: CollabDocumentParamsSchema })
    params: CollabDocumentParamsDto,
    @CurrentReaderId() readerId: string,
  ) {
    return this.collab.workspaceFor(params.documentId, readerId)
  }

  @Get('/documents/:documentId/crdt')
  @ReaderAuth()
  @HTTPDecorators.RawResponse
  async exportCrdt(
    @Param({ schema: CollabDocumentParamsSchema })
    params: CollabDocumentParamsDto,
    @Query({ schema: CollabCrdtQuerySchema }) query: CollabCrdtQueryDto,
    @CurrentReaderId() readerId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const bytes = await this.collab.exportCrdt(
      params.documentId,
      readerId,
      query.since
        ? new Uint8Array(Buffer.from(query.since, 'base64'))
        : undefined,
    )
    reply.type('application/octet-stream')
    return Buffer.from(bytes)
  }

  @Post('/documents/:documentId/crdt')
  @ReaderAuth()
  @HttpCode(204)
  @WithFastifyRouteOptions({ bodyLimit: CRDT_UPDATE_BODY_LIMIT })
  async importCrdt(
    @Param({ schema: CollabDocumentParamsSchema })
    params: CollabDocumentParamsDto,
    @CurrentReaderId() readerId: string,
    @Req() request: FastifyRequest,
  ) {
    if (!Buffer.isBuffer(request.body)) {
      throw createAppException(AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED, {
        branchId: params.documentId,
        reason: 'expected an application/octet-stream body',
      })
    }
    await this.collab.importCrdt(
      params.documentId,
      readerId,
      new Uint8Array(request.body),
    )
  }
}
