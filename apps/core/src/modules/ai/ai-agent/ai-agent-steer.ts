import type { AgentFileSnapshot, AgentToolImage } from '@mx-space/ai'

export interface AgentSteer {
  user: string
  files: AgentFileSnapshot[]
  images?: AgentToolImage[]
}

export interface AgentSteerInbox {
  push: (steer: AgentSteer) => boolean
  take: (options?: { close?: boolean }) => AgentSteer[]
}

export function createSteerInbox(): AgentSteerInbox {
  let queue: AgentSteer[] = []
  let closed = false
  return {
    push: (steer) => {
      if (closed) return false
      queue.push(steer)
      return true
    },
    take: (options) => {
      const taken = queue
      queue = []
      if (options?.close) closed = true
      return taken
    },
  }
}
