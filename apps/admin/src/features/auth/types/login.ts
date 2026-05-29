export interface AllowLoginResponse {
  github?: boolean
  google?: boolean
  passkey: boolean
  password: boolean
}

export interface InitResponse {
  isInit: boolean
}
