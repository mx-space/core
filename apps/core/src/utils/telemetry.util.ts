import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from '~/constants/path.constant'
import { PKG } from './pkg.util'

const TELEMETRY_URL = 'https://mx-telemetry.tukon479.workers.dev'
const TELEMETRY_ID_FILE = join(DATA_DIR, 'telemetry-id')

function getOrCreateInstanceId(): string {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  if (existsSync(TELEMETRY_ID_FILE)) {
    const id = readFileSync(TELEMETRY_ID_FILE, 'utf-8').trim()
    if (id) return id
  }

  const newId = randomUUID()
  writeFileSync(TELEMETRY_ID_FILE, newId, 'utf-8')
  return newId
}

export async function sendTelemetry(event: string): Promise<void> {
  try {
    const instanceId = getOrCreateInstanceId()

    const payload = {
      instanceId,
      version: PKG.version,
      nodeVersion: process.version.slice(1),
      event,
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    await fetch(`${TELEMETRY_URL}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
  } catch {
    // Silently ignore telemetry errors
  }
}

const HEARTBEAT_INTERVAL = 60 * 60 * 1000 // 1 hour

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function startHeartbeat(): void {
  if (heartbeatTimer) return

  heartbeatTimer = setInterval(() => {
    sendTelemetry('heartbeat')
  }, HEARTBEAT_INTERVAL)

  // Ensure the timer doesn't prevent the process from exiting
  heartbeatTimer.unref()
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}
