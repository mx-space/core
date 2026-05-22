export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public path: string,
    public raw: any,
    public code?: string | number,
    public details?: unknown,
  ) {
    super(message)
  }
}
