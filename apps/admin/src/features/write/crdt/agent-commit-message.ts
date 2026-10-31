const SUMMARY_LIMIT = 60
const WRITE_SUFFIX = / #\d+$/

export const agentCommitMessage = (request: string) =>
  `agent:${request.replaceAll(/\s+/g, ' ').trim().slice(0, SUMMARY_LIMIT)}`

// Loro merges consecutive same-peer changes with one message and keeps the first
// timestamp, which would age later writes of a turn out of the live agent window.
export const agentWriteMessage = (turn: string, write: number) =>
  `${turn} #${write}`

export const agentTurnMessage = (message: string) =>
  message.replace(WRITE_SUFFIX, '')
