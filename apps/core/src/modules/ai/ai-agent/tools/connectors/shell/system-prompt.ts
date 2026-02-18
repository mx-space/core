import type { AIAgentToolSystemPrompt } from '../../connector.types'
import { SHELL_COMMAND_WHITELIST } from './executor'

const WHITELIST_HINT = SHELL_COMMAND_WHITELIST.join(', ')

export const shellToolSystemPrompt: AIAgentToolSystemPrompt = {
  purpose:
    'Inspect the Mix Space server environment and run shell commands to troubleshoot or verify runtime state.',
  whenToUse: [
    'Use this tool when the user asks about server health, process status, disk/memory usage, log files, or environment variables.',
    'Use this tool to verify runtime state (e.g. whether a process is running, a file exists, or a directory is readable) before drawing conclusions.',
    'Prefer read-only inspection commands before suggesting any server-side changes.',
  ],
  usageRules: [
    `Whitelisted read-only commands (${WHITELIST_HINT}) execute directly without confirmation.`,
    'Non-whitelisted commands (e.g. rm, kill, systemctl, npm, pm2) return a pending confirmation actionId and are NOT executed immediately.',
    'If a command is pending confirmation, explain to the user what it will do and ask them to confirm in the UI before continuing.',
    'Useful inspection patterns for Mix Space: check process list with ps (look for node/pm2), inspect log files with tail/cat, check disk with df/du, verify env with echo, search config or source files with rg/find.',
    'Never construct commands that read sensitive files like private keys or raw credential files unless the user explicitly asks.',
  ],
}
