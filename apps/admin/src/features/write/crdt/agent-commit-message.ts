const SUMMARY_LIMIT = 60

export const agentCommitMessage = (request: string) =>
  `agent:${request.replaceAll(/\s+/g, ' ').trim().slice(0, SUMMARY_LIMIT)}`
