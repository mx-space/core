export interface TokenModel {
  id: string
  createdAt: string
  token: string
  expired?: Date
  name: string
}
