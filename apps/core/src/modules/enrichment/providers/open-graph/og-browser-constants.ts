export const OG_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const OG_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'

export const OG_LAUNCH_ARGS = '--disable-blink-features=AutomationControlled'

export const OG_CHALLENGE_SIGNATURES = [
  'just a moment',
  'attention required',
  'access denied',
  'verify you are human',
  '403 forbidden',
  'pardon our interruption',
] as const

export const OG_CHALLENGE_RETRY_MAX = 1
export const OG_NETWORKIDLE_MS = 10_000
export const OG_HTML_SCAN_HEAD_BYTES = 8 * 1024
