import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

import { caretAtBlock } from '@mx-space/editor/loro'
import type { LoroDoc } from 'loro-crdt'
import { detectAgent } from 'ryugi-detect-agent'

import { openRoom } from './room'

const HOLD_ENV = 'MXS_PRESENCE_HOLD'
const HOLD_MS = 3000

interface Hold {
  readonly url: string
  readonly headers: Record<string, string>
  readonly draftId: string
  readonly entry: string
  readonly caret: unknown
}

export const agentCaret = (doc: LoroDoc, blockId: string | null) => ({
  anchor: null,
  focus: blockId ? caretAtBlock(doc, blockId) : null,
  label: detectAgent(process.env) ?? 'AI',
})

export const newAgentEntry = () => `agent:${randomBytes(6).toString('hex')}`

export const randomPeer = (): `${number}` =>
  `${randomBytes(8).readBigUInt64BE()}` as `${number}`

// The caret has to outlive this command, or `collab.peer.left` clears it before anyone sees it.
export function holdPresenceInBackground(hold: Hold) {
  const child = spawn(
    process.execPath,
    [...process.execArgv, process.argv[1]!, 'draft', 'patch', hold.draftId],
    {
      detached: true,
      env: { ...process.env, [HOLD_ENV]: JSON.stringify(hold) },
      stdio: 'ignore',
    },
  )
  child.unref()
}

export const pendingHold = (): Hold | null => {
  const raw = process.env[HOLD_ENV]
  return raw ? (JSON.parse(raw) as Hold) : null
}

export async function runHold(hold: Hold) {
  const room = await openRoom({
    url: hold.url,
    headers: hold.headers,
    draftId: hold.draftId,
  })
  try {
    await room.presence({ caret: hold.caret, entry: hold.entry })
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS))
  } finally {
    room.close()
  }
}
