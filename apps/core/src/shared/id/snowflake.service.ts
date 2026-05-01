import { Injectable, Logger } from '@nestjs/common'

import { SNOWFLAKE } from '~/app.config'

import { type EntityId, serializeEntityId } from './entity-id'

const SEQUENCE_BITS = 12n
const WORKER_ID_BITS = 10n
const SEQUENCE_MASK = (1n << SEQUENCE_BITS) - 1n // 4095
const WORKER_ID_MAX = (1n << WORKER_ID_BITS) - 1n // 1023
const TIMESTAMP_LEFT_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS
const WORKER_ID_LEFT_SHIFT = SEQUENCE_BITS
const TIMESTAMP_BITS = 41n
const TIMESTAMP_MAX = (1n << TIMESTAMP_BITS) - 1n

export const SNOWFLAKE_EPOCH_MS = 1746144000000n

export interface SnowflakeOptions {
  workerId: number
  epochMs?: bigint
  /** Allow blocking until clock catches up. Default: false (throw). */
  toleratesBackwardsClockMs?: number
  now?: () => number
}

interface DecodedSnowflake {
  timestampMs: bigint
  workerId: bigint
  sequence: bigint
}

/**
 * Pure Snowflake generator. Use directly in tests or compose into a Nest provider.
 */
export class SnowflakeGenerator {
  private readonly workerIdBig: bigint
  private readonly epochMs: bigint
  private readonly toleratesBackwardsClockMs: number
  private readonly now: () => number
  private lastTimestamp = -1n
  private sequence = 0n

  constructor(options: SnowflakeOptions) {
    if (
      typeof options.workerId !== 'number' ||
      !Number.isInteger(options.workerId)
    ) {
      throw new Error(
        `SnowflakeGenerator: workerId must be an integer, got ${options.workerId}`,
      )
    }
    const workerIdBig = BigInt(options.workerId)
    if (workerIdBig < 0n || workerIdBig > WORKER_ID_MAX) {
      throw new Error(
        `SnowflakeGenerator: workerId ${options.workerId} out of range [0, ${WORKER_ID_MAX}]`,
      )
    }
    this.workerIdBig = workerIdBig
    this.epochMs = options.epochMs ?? SNOWFLAKE_EPOCH_MS
    this.toleratesBackwardsClockMs = options.toleratesBackwardsClockMs ?? 0
    this.now = options.now ?? Date.now
  }

  get workerId(): number {
    return Number(this.workerIdBig)
  }

  nextId(): EntityId {
    return serializeEntityId(this.nextBigInt())
  }

  nextBigInt(): bigint {
    let timestamp = BigInt(this.now())

    if (timestamp < this.lastTimestamp) {
      const drift = this.lastTimestamp - timestamp
      if (drift <= BigInt(this.toleratesBackwardsClockMs)) {
        while (timestamp < this.lastTimestamp) {
          timestamp = BigInt(this.now())
        }
      } else {
        throw new Error(
          `SnowflakeGenerator: clock moved backwards by ${drift}ms; refusing to generate ID`,
        )
      }
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & SEQUENCE_MASK
      if (this.sequence === 0n) {
        timestamp = this.tilNextMillis(this.lastTimestamp)
      }
    } else {
      this.sequence = 0n
    }

    this.lastTimestamp = timestamp

    const elapsed = timestamp - this.epochMs
    if (elapsed < 0n) {
      throw new Error(
        `SnowflakeGenerator: current timestamp ${timestamp} is before epoch ${this.epochMs}`,
      )
    }
    if (elapsed > TIMESTAMP_MAX) {
      throw new Error(
        `SnowflakeGenerator: timestamp overflow; epoch must be advanced before continuing`,
      )
    }

    return (
      (elapsed << TIMESTAMP_LEFT_SHIFT) |
      (this.workerIdBig << WORKER_ID_LEFT_SHIFT) |
      this.sequence
    )
  }

  decode(id: EntityId | bigint): DecodedSnowflake {
    const value = typeof id === 'bigint' ? id : BigInt(id)
    const sequence = value & SEQUENCE_MASK
    const workerId = (value >> WORKER_ID_LEFT_SHIFT) & WORKER_ID_MAX
    const timestamp = (value >> TIMESTAMP_LEFT_SHIFT) + this.epochMs
    return { timestampMs: timestamp, workerId, sequence }
  }

  private tilNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = BigInt(this.now())
    while (timestamp <= lastTimestamp) {
      timestamp = BigInt(this.now())
    }
    return timestamp
  }
}

/**
 * Application-wide Nest provider. Constructed from SNOWFLAKE config.
 * Tests should prefer constructing SnowflakeGenerator directly.
 */
@Injectable()
export class SnowflakeService extends SnowflakeGenerator {
  private readonly nestLogger = new Logger(SnowflakeService.name)

  constructor() {
    super({
      workerId: SNOWFLAKE.workerId,
      epochMs: BigInt(SNOWFLAKE.epochMs),
    })
    this.nestLogger.log(
      `Snowflake worker ${SNOWFLAKE.workerId} ready (epoch ${SNOWFLAKE.epochMs})`,
    )
  }
}
