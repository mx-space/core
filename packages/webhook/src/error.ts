/* eslint-disable unicorn/custom-error-definition */
export class InvalidSignatureError extends Error {
  constructor() {
    super('Invalid Signature')
  }
}
