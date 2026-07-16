import { randomUUID } from 'node:crypto'

import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import type IORedis from 'ioredis'

import { BusinessEvents } from '~/constants/business-event.constant'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'

import { COMPANION_PRESENCE_LEASE_MAX_SECONDS } from './companion.constants'
import {
  CompanionPresenceMutationDataV2Schema,
  PublicLiveDeskStateV2Schema,
} from './companion.schema'
import type {
  CompanionPresenceClearRequestV2,
  CompanionPresenceMutationResponseV2,
  CompanionPresenceRequestV2,
  PublicLiveDeskProjectionV2,
  PublicLiveDeskStateV2,
} from './companion.types'
import {
  canonicalJSONStringify,
  createPublicLiveDeskProjection,
  fingerprintCompanionMutation,
} from './companion-presence.projection'

const STORE_KEYS = {
  records: getRedisKey('companion:presence:records'),
  deadlines: getRedisKey('companion:presence:deadlines'),
  updated: getRedisKey('companion:presence:updated'),
  epoch: getRedisKey('companion:presence:epoch'),
  revision: getRedisKey('companion:presence:revision'),
  publicProjection: getRedisKey('companion:presence:public'),
  broadcastPending: getRedisKey('companion:presence:broadcast-pending'),
  auditCursor: getRedisKey('companion:presence:audit-cursor'),
  // Device identifiers are immutable and never reused. Revocation tombstones
  // therefore have no TTL and outlive ephemeral Projection authority resets.
  // They are removed only by an explicit full Companion authority teardown.
  revokedDevices: getRedisKey('companion:presence:revoked-devices'),
} as const

const ACK_BROADCAST_SCRIPT = String.raw`
local current = redis.call('GET', KEYS[1])
if not current or current ~= ARGV[1] then
  return 0
end

local pending = cjson.decode(current)
local attempts = tonumber(pending.attempts or 0) + 1
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
else
  pending.attempts = attempts
  redis.call('SET', KEYS[1], cjson.encode(pending))
end
return attempts
`

const TRANSITION_SCRIPT = String.raw`
local recordsKey = KEYS[1]
local deadlinesKey = KEYS[2]
local updatedKey = KEYS[3]
local epochKey = KEYS[4]
local revisionKey = KEYS[5]
local publicKey = KEYS[6]
local broadcastPendingKey = KEYS[7]
local auditCursorKey = KEYS[8]
local revokedDevicesKey = KEYS[9]

local nowMs = tonumber(ARGV[1])
local generatedEpoch = ARGV[2]
local operation = ARGV[3]
local deviceId = ARGV[4]
local sequence = tonumber(ARGV[5])
local fingerprint = ARGV[6]
local projectionJson = ARGV[7]
local receivedAt = ARGV[8]

local epoch = redis.call('GET', epochKey)
local revisionValue = redis.call('GET', revisionKey)
local publicValue = redis.call('GET', publicKey)
local parsedRevision = tonumber(revisionValue)
local publicValueIsJSON = false
if publicValue then
  publicValueIsJSON = pcall(cjson.decode, publicValue)
end
local initialized = false
if not epoch
  or not parsedRevision
  or parsedRevision < 0
  or parsedRevision > 9007199254740991
  or parsedRevision ~= math.floor(parsedRevision)
  or not publicValueIsJSON
then
  -- Do not delete revokedDevicesKey here. Epoch initialization repairs only
  -- ephemeral Projection authority; device revocation is long-lived authority.
  redis.call(
    'DEL',
    recordsKey,
    deadlinesKey,
    updatedKey,
    epochKey,
    revisionKey,
    publicKey,
    broadcastPendingKey,
    auditCursorKey
  )
  epoch = generatedEpoch
  redis.call('SET', epochKey, epoch)
  redis.call('SET', revisionKey, '0')
  redis.call('SET', publicKey, 'null')
  revisionValue = '0'
  publicValue = 'null'
  parsedRevision = 0
  initialized = true
end

local revision = parsedRevision
local oldPublicJson = publicValue

-- Authentication can complete before an owner revocation commits. Reject the
-- resulting in-flight mutation before reading or advancing its sequence state.
if (operation == 'snapshot' or operation == 'clear')
  and redis.call('HEXISTS', revokedDevicesKey, deviceId) == 1
then
  if initialized then
    redis.call('SET', broadcastPendingKey, cjson.encode({
      attempts = 0,
      state = {
        schemaVersion = 2,
        epoch = epoch,
        revision = revision,
        projection = cjson.decode(oldPublicJson)
      }
    }))
  end
  return {
    'revoked',
    epoch,
    tostring(revision),
    oldPublicJson,
    initialized and '1' or '0',
    '-1',
    receivedAt,
    ''
  }
end

local function scrubPresenceContent(record)
  record.projectionJson = nil
  record.updatedAtMs = nil
  record.expiresAtMs = nil
  -- Retain only the monotonic counter after the bounded idempotency window.
  -- Fingerprints and accepted responses derive from private presence content.
  record.fingerprint = nil
  record.acceptedResultJson = nil
  return record
end

if revision >= 9007199254740991 then
  return {'overflow', epoch, tostring(revision), oldPublicJson, '0', '-1', '', ''}
end

local expiredDeviceIds = redis.call(
  'ZRANGEBYSCORE',
  deadlinesKey,
  '-inf',
  tostring(nowMs)
)
for _, expiredDeviceId in ipairs(expiredDeviceIds) do
  local rawRecord = redis.call('HGET', recordsKey, expiredDeviceId)
  if rawRecord then
    local record = cjson.decode(rawRecord)
    redis.call(
      'HSET',
      recordsKey,
      expiredDeviceId,
      cjson.encode(scrubPresenceContent(record))
    )
  end
  redis.call('ZREM', deadlinesKey, expiredDeviceId)
  redis.call('ZREM', updatedKey, expiredDeviceId)
end

-- The sorted deadline index is an acceleration structure, not an authority.
-- Incrementally audit the bounded device hash so an evicted index member can
-- never retain content indefinitely. The one-second reaper advances this scan.
local auditCursor = redis.call('GET', auditCursorKey) or '0'
local auditResult = redis.call('HSCAN', recordsKey, auditCursor, 'COUNT', '100')
redis.call('SET', auditCursorKey, auditResult[1])
local auditedRecords = auditResult[2]
for index = 1, #auditedRecords, 2 do
  local auditedDeviceId = auditedRecords[index]
  local auditedRecord = cjson.decode(auditedRecords[index + 1])
  local auditedExpiry = tonumber(auditedRecord.expiresAtMs)
  if auditedExpiry and auditedExpiry <= nowMs then
    redis.call(
      'HSET',
      recordsKey,
      auditedDeviceId,
      cjson.encode(scrubPresenceContent(auditedRecord))
    )
    redis.call('ZREM', deadlinesKey, auditedDeviceId)
    redis.call('ZREM', updatedKey, auditedDeviceId)
  end
end

local status = operation
local acceptedSequence = -1
local acceptedResultJson = ''
local pendingRecord = nil

if operation == 'snapshot' or operation == 'clear' then
  local rawRecord = redis.call('HGET', recordsKey, deviceId)
  local record = rawRecord and cjson.decode(rawRecord) or {
    acceptedSequence = -1
  }
  local recordExpiry = tonumber(record.expiresAtMs)
  if recordExpiry and recordExpiry <= nowMs then
    record = scrubPresenceContent(record)
    redis.call('ZREM', deadlinesKey, deviceId)
    redis.call('ZREM', updatedKey, deviceId)
  end
  local previousSequence = tonumber(record.acceptedSequence or -1)
  acceptedSequence = previousSequence

  if sequence < previousSequence then
    status = 'stale'
  elseif sequence == previousSequence then
    if record.fingerprint == fingerprint then
      status = 'duplicate'
      acceptedResultJson = record.acceptedResultJson or ''
    else
      status = 'conflict'
    end
  else
    status = 'accepted'
    acceptedSequence = sequence
    record.acceptedSequence = sequence
    record.fingerprint = fingerprint

    if operation == 'snapshot' then
      local projection = cjson.decode(projectionJson)
      record.projectionJson = projectionJson
      record.updatedAtMs = nowMs
      record.expiresAtMs = tonumber(
        string.format('%.0f', nowMs + ((tonumber(ARGV[9]) or 0) * 1000))
      )
      redis.call('ZADD', deadlinesKey, record.expiresAtMs, deviceId)
      redis.call('ZADD', updatedKey, record.updatedAtMs, deviceId)
    else
      record.projectionJson = nil
      record.updatedAtMs = nil
      -- A clear response may contain another device's fallback Projection.
      -- Keep it only for a bounded exact-retry window, then scrub its content.
      record.expiresAtMs = tonumber(
        string.format('%.0f', nowMs + ((tonumber(ARGV[10]) or 0) * 1000))
      )
      redis.call('ZADD', deadlinesKey, record.expiresAtMs, deviceId)
      redis.call('ZREM', updatedKey, deviceId)
    end

    pendingRecord = record
    redis.call('HSET', recordsKey, deviceId, cjson.encode(record))
  end
elseif operation == 'revoke' then
  -- HSETNX preserves the first revocation marker and makes retries idempotent.
  redis.call('HSETNX', revokedDevicesKey, deviceId, receivedAt)
  redis.call('HDEL', recordsKey, deviceId)
  redis.call('ZREM', deadlinesKey, deviceId)
  redis.call('ZREM', updatedKey, deviceId)
end

local newPublicJson = 'null'
while true do
  local selected = redis.call('ZREVRANGE', updatedKey, 0, 0)
  if #selected == 0 then
    break
  end

  local selectedDeviceId = selected[1]
  local selectedRecordJson = redis.call('HGET', recordsKey, selectedDeviceId)
  if selectedRecordJson then
    local selectedRecord = cjson.decode(selectedRecordJson)
    local selectedExpiry = tonumber(selectedRecord.expiresAtMs)
    if selectedRecord.projectionJson
      and selectedExpiry
      and selectedExpiry > nowMs
    then
      newPublicJson = selectedRecord.projectionJson
      -- Repair an evicted deadline index member while treating the record's
      -- own expiry as the source of truth.
      redis.call('ZADD', deadlinesKey, selectedExpiry, selectedDeviceId)
      break
    end

    redis.call(
      'HSET',
      recordsKey,
      selectedDeviceId,
      cjson.encode(scrubPresenceContent(selectedRecord))
    )
  end
  redis.call('ZREM', deadlinesKey, selectedDeviceId)
  redis.call('ZREM', updatedKey, selectedDeviceId)
end

local publicChanged = newPublicJson ~= oldPublicJson
if publicChanged then
  revision = redis.call('INCR', revisionKey)
  redis.call('SET', publicKey, newPublicJson)
end

local state = {
  schemaVersion = 2,
  epoch = epoch,
  revision = revision,
  projection = cjson.decode(newPublicJson)
}

if status == 'accepted' then
  acceptedResultJson = cjson.encode({
    acceptedSequence = acceptedSequence,
    receivedAt = receivedAt,
    state = state
  })
  pendingRecord.acceptedResultJson = acceptedResultJson
  redis.call('HSET', recordsKey, deviceId, cjson.encode(pendingRecord))
end

local shouldBroadcast = publicChanged or initialized
if shouldBroadcast then
  redis.call('SET', broadcastPendingKey, cjson.encode({
    attempts = 0,
    state = state
  }))
end
return {
  status,
  epoch,
  tostring(revision),
  newPublicJson,
  shouldBroadcast and '1' or '0',
  tostring(acceptedSequence),
  receivedAt,
  acceptedResultJson
}
`

type TransitionStatus =
  | 'accepted'
  | 'duplicate'
  | 'stale'
  | 'conflict'
  | 'read'
  | 'revoke'
  | 'revoked'
  | 'overflow'

interface TransitionResult {
  status: TransitionStatus
  state: PublicLiveDeskStateV2
  shouldBroadcast: boolean
  acceptedSequence: number
  acceptedResultJson: string
}

export class CompanionSequenceError extends Error {
  constructor(
    readonly code: 'COMPANION_SEQUENCE_STALE' | 'COMPANION_SEQUENCE_CONFLICT',
    readonly acceptedSequence: number,
  ) {
    super(
      code === 'COMPANION_SEQUENCE_STALE'
        ? 'Presence sequence is older than the accepted sequence.'
        : 'Presence sequence conflicts with the accepted operation.',
    )
    this.name = CompanionSequenceError.name
  }
}

export class CompanionDeviceRevokedError extends Error {
  readonly code = 'COMPANION_DEVICE_REVOKED' as const

  constructor() {
    super('Companion device token is invalid or revoked.')
    this.name = CompanionDeviceRevokedError.name
  }
}

@Injectable()
export class CompanionPresenceStore {
  private readonly logger = new Logger(CompanionPresenceStore.name)

  constructor(
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly webEventsGateway?: WebEventsGateway,
  ) {}

  get isAvailable() {
    return Boolean(this.redisService)
  }

  async putSnapshot(
    request: CompanionPresenceRequestV2,
    receivedAt = new Date(),
  ): Promise<CompanionPresenceMutationResponseV2['data']> {
    const projection = createPublicLiveDeskProjection(request, receivedAt)
    const transition = await this.transition({
      operation: 'snapshot',
      deviceId: request.meta.deviceId,
      sequence: request.meta.sequence,
      fingerprint: fingerprintCompanionMutation('snapshot', request),
      projection,
      ttlSeconds: request.data.lease.ttlSeconds,
      receivedAt,
    })

    return this.resolveMutationResult(transition)
  }

  async clear(
    request: CompanionPresenceClearRequestV2,
    receivedAt = new Date(),
  ): Promise<CompanionPresenceMutationResponseV2['data']> {
    const transition = await this.transition({
      operation: 'clear',
      deviceId: request.meta.deviceId,
      sequence: request.meta.sequence,
      fingerprint: fingerprintCompanionMutation('clear', request),
      receivedAt,
    })

    return this.resolveMutationResult(transition)
  }

  async getPublicState(now = new Date()) {
    const transition = await this.transition({
      operation: 'read',
      receivedAt: now,
    })
    return transition.state
  }

  async removeDevice(deviceId: string, now = new Date()) {
    const transition = await this.transition({
      operation: 'revoke',
      deviceId,
      receivedAt: now,
    })
    return transition.state
  }

  /// Replays the latest unacknowledged public state. A state is emitted three
  /// times before removal because the current Socket.IO Redis emitter does not
  /// expose its underlying publish promise. Duplicate revisions are harmless
  /// to v2 consumers, while the Redis marker closes the commit-before-publish
  /// process-crash window.
  async flushPendingBroadcast(maximumAttempts = 3) {
    if (!this.webEventsGateway) return false
    const redis = this.getRedisClient()
    const pendingJSON = await redis.get(STORE_KEYS.broadcastPending)
    if (!pendingJSON) return false

    let state: PublicLiveDeskStateV2
    try {
      const pending = JSON.parse(pendingJSON) as { state?: unknown }
      state = PublicLiveDeskStateV2Schema.parse(pending.state)
    } catch (error) {
      this.logger.error(
        `Discarding invalid companion broadcast marker: ${error instanceof Error ? error.message : String(error)}`,
      )
      await redis.del(STORE_KEYS.broadcastPending)
      return false
    }

    if (!this.broadcast(state)) return false
    await redis.eval(
      ACK_BROADCAST_SCRIPT,
      1,
      STORE_KEYS.broadcastPending,
      pendingJSON,
      String(maximumAttempts),
    )
    return true
  }

  private resolveMutationResult(transition: TransitionResult) {
    if (transition.status === 'revoked') {
      throw new CompanionDeviceRevokedError()
    }
    if (transition.status === 'stale') {
      throw new CompanionSequenceError(
        'COMPANION_SEQUENCE_STALE',
        transition.acceptedSequence,
      )
    }
    if (transition.status === 'conflict') {
      throw new CompanionSequenceError(
        'COMPANION_SEQUENCE_CONFLICT',
        transition.acceptedSequence,
      )
    }
    if (transition.status === 'overflow') {
      throw new ServiceUnavailableException(
        'Companion presence revision space is exhausted.',
      )
    }

    return CompanionPresenceMutationDataV2Schema.parse(
      JSON.parse(transition.acceptedResultJson),
    )
  }

  private async transition(input: {
    operation: 'snapshot' | 'clear' | 'read' | 'revoke'
    deviceId?: string
    sequence?: number
    fingerprint?: string
    projection?: PublicLiveDeskProjectionV2
    ttlSeconds?: number
    receivedAt: Date
  }): Promise<TransitionResult> {
    const redis = this.getRedisClient()
    const receivedAt = input.receivedAt.toISOString()
    const result = (await redis.eval(
      TRANSITION_SCRIPT,
      9,
      STORE_KEYS.records,
      STORE_KEYS.deadlines,
      STORE_KEYS.updated,
      STORE_KEYS.epoch,
      STORE_KEYS.revision,
      STORE_KEYS.publicProjection,
      STORE_KEYS.broadcastPending,
      STORE_KEYS.auditCursor,
      STORE_KEYS.revokedDevices,
      String(input.receivedAt.getTime()),
      randomUUID(),
      input.operation,
      input.deviceId ?? '',
      String(input.sequence ?? -1),
      input.fingerprint ?? '',
      input.projection ? canonicalJSONStringify(input.projection) : 'null',
      receivedAt,
      String(input.ttlSeconds ?? 0),
      String(COMPANION_PRESENCE_LEASE_MAX_SECONDS),
    )) as string[]

    const state = PublicLiveDeskStateV2Schema.parse({
      schemaVersion: 2,
      epoch: result[1],
      revision: Number(result[2]),
      projection: JSON.parse(result[3]),
    })
    const transition: TransitionResult = {
      status: result[0] as TransitionStatus,
      state,
      shouldBroadcast: result[4] === '1',
      acceptedSequence: Number(result[5]),
      acceptedResultJson: result[7],
    }

    if (transition.shouldBroadcast) await this.flushPendingBroadcast()
    return transition
  }

  private getRedisClient(): IORedis {
    if (!this.redisService) {
      throw new ServiceUnavailableException(
        'Companion presence storage is not available.',
      )
    }
    return this.redisService.getClient()
  }

  private broadcast(state: PublicLiveDeskStateV2) {
    if (!this.webEventsGateway) return false
    try {
      this.webEventsGateway.broadcast(
        BusinessEvents.COMPANION_PRESENCE_CHANGED,
        state,
      )
      return true
    } catch (error) {
      this.logger.error(
        `Failed to broadcast companion presence state: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }
}
