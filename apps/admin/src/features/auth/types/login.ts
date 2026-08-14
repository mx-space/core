export interface AllowLoginResponse {
  apple?: boolean
  github?: boolean
  google?: boolean
  passkey: boolean
  password: boolean
}

export interface InitResponse {
  isInit: boolean
}
