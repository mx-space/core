/**
 * Lua script: Atomically pop from pending queue and acquire lock
 *
 * KEYS[1] = pending queue
 * KEYS[2] = processing zset
 * ARGV[1] = workerId
 * ARGV[2] = lockTTL (ms)
 * ARGV[3] = now (ms)
 * ARGV[4] = lockKeyPrefix
 * ARGV[5] = taskKeyPrefix
 *
 * Returns: taskId or nil
 */
export const LUA_ACQUIRE_TASK = `
local taskId = redis.call('LPOP', KEYS[1])
if not taskId then return nil end

local lockKey = ARGV[4] .. taskId
local taskKey = ARGV[5] .. taskId

-- Try to acquire lock
local locked = redis.call('SET', lockKey, ARGV[1], 'NX', 'PX', ARGV[2])
if not locked then
  -- Lock failed, push back to queue tail
  redis.call('RPUSH', KEYS[1], taskId)
  return nil
end

-- Add to processing zset (score = now)
redis.call('ZADD', KEYS[2], ARGV[3], taskId)

-- Update task status
redis.call('HSET', taskKey,
  'status', 'running',
  'startedAt', ARGV[3],
  'lastHeartbeat', ARGV[3],
  'workerId', ARGV[1]
)

return taskId
`

/**
 * Lua script: Atomically update task status with index maintenance
 *
 * KEYS[1] = task hash key
 * KEYS[2] = processing zset
 * ARGV[1] = taskId
 * ARGV[2] = newStatus
 * ARGV[3] = now
 * ARGV[4] = statusIndexPrefix (e.g., "mx:task-queue:index:status:")
 * ARGV[5...] = additional field pairs (key, value, key, value, ...)
 *
 * Returns: 1 if updated, 0 if status unchanged
 */
export const LUA_UPDATE_STATUS = `
local oldStatus = redis.call('HGET', KEYS[1], 'status')
if oldStatus == ARGV[2] then return 0 end

-- Update Hash
redis.call('HSET', KEYS[1], 'status', ARGV[2], 'lastHeartbeat', ARGV[3])
for i = 5, #ARGV, 2 do
  if ARGV[i] and ARGV[i+1] then
    redis.call('HSET', KEYS[1], ARGV[i], ARGV[i+1])
  end
end

-- Update indexes based on actual oldStatus from Redis
local score = redis.call('HGET', KEYS[1], 'createdAt')
if oldStatus then
  local oldIndexKey = ARGV[4] .. oldStatus
  redis.call('ZREM', oldIndexKey, ARGV[1])
end
local newIndexKey = ARGV[4] .. ARGV[2]
redis.call('ZADD', newIndexKey, score, ARGV[1])

-- If task is no longer running, remove from processing set
if ARGV[2] ~= 'running' then
  redis.call('ZREM', KEYS[2], ARGV[1])
end

return 1
`

/**
 * Lua script: Recover stale tasks (small batch)
 *
 * KEYS[1] = processing zset
 * KEYS[2] = pending queue
 * ARGV[1] = threshold (ms) - tasks with heartbeat older than this are stale
 * ARGV[2] = maxRetries
 * ARGV[3] = now (ms)
 * ARGV[4] = batchSize
 * ARGV[5] = lockKeyPrefix
 * ARGV[6] = taskKeyPrefix
 * ARGV[7] = pendingIndexKey
 * ARGV[8] = failedIndexKey
 * ARGV[9] = runningIndexKey
 *
 * Returns: number of recovered tasks
 */
export const LUA_RECOVER_STALE = `
local stale = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[4])
local recovered = 0

for _, taskId in ipairs(stale) do
  local lockKey = ARGV[5] .. taskId
  local taskKey = ARGV[6] .. taskId

  -- Check if lock still exists
  local lockExists = redis.call('EXISTS', lockKey)
  if lockExists == 0 then
    -- Lock expired, can recover
    -- First check if task hash exists (might have been deleted)
    local taskExists = redis.call('EXISTS', taskKey)
    if taskExists == 0 then
      -- Task was deleted, just remove from processing set
      redis.call('ZREM', KEYS[1], taskId)
      redis.call('ZREM', ARGV[9], taskId)
    else
      local retryCount = tonumber(redis.call('HGET', taskKey, 'retryCount') or '0')
      local createdAt = redis.call('HGET', taskKey, 'createdAt')

      -- Remove from processing
      redis.call('ZREM', KEYS[1], taskId)

      -- Remove from running index
      redis.call('ZREM', ARGV[9], taskId)

      if retryCount < tonumber(ARGV[2]) then
        -- Re-queue
        redis.call('HSET', taskKey,
          'status', 'pending',
          'retryCount', tostring(retryCount + 1),
          'lastHeartbeat', ARGV[3],
          'workerId', ''
        )
        redis.call('RPUSH', KEYS[2], taskId)
        -- Update status index
        redis.call('ZADD', ARGV[7], createdAt, taskId)
      else
        -- Mark as failed
        redis.call('HSET', taskKey,
          'status', 'failed',
          'error', 'Max retries exceeded',
          'completedAt', ARGV[3],
          'lastHeartbeat', ARGV[3]
        )
        -- Set 24h TTL
        redis.call('EXPIRE', taskKey, 86400)
        redis.call('EXPIRE', taskKey .. ':logs', 86400)
        -- Update status index
        redis.call('ZADD', ARGV[8], createdAt, taskId)
      end

      recovered = recovered + 1
    end
  end
end

return recovered
`

/**
 * Lua script: Cancel a pending task atomically
 *
 * KEYS[1] = task hash key
 * KEYS[2] = pending queue
 * KEYS[3] = pending index
 * KEYS[4] = cancelled index
 * ARGV[1] = taskId
 * ARGV[2] = now (ms)
 *
 * Returns: 1 if cancelled, 0 if not pending
 */
export const LUA_CANCEL_PENDING = `
local status = redis.call('HGET', KEYS[1], 'status')
if status ~= 'pending' then return 0 end

local createdAt = redis.call('HGET', KEYS[1], 'createdAt')

-- Update status
redis.call('HSET', KEYS[1],
  'status', 'cancelled',
  'completedAt', ARGV[2],
  'lastHeartbeat', ARGV[2]
)

-- Remove from pending queue
redis.call('LREM', KEYS[2], 1, ARGV[1])

-- Update indexes
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('ZADD', KEYS[4], createdAt, ARGV[1])

-- Set 24h TTL for both task hash and logs
redis.call('EXPIRE', KEYS[1], 86400)
redis.call('EXPIRE', KEYS[1] .. ':logs', 86400)

return 1
`
