export interface WsRequestError extends Error {
  code?: string
}

export function createWsError(message: string, code: string): WsRequestError {
  const error = new Error(message) as WsRequestError
  error.code = code
  return error
}
