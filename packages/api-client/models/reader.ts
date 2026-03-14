export interface ReaderModel {
  email: string
  name: string
  handle: string

  image: string

  role?: 'reader' | 'owner'
}
