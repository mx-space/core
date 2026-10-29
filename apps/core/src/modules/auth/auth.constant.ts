export const AuthInstanceInjectKey = Symbol('AuthInstance')

export const HASHED_API_KEY_CONFIG_ID = 'mx-hashed-v1'

export const MXS_CLI_CLIENT_ID = 'mxs-cli'
export const SPACE_IOS_CLIENT_ID = 'space-ios'

export const DEVICE_AUTHORIZATION_CLIENT_NAMES: ReadonlyMap<string, string> =
  new Map([
    [MXS_CLI_CLIENT_ID, 'Mix Space CLI'],
    [SPACE_IOS_CLIENT_ID, 'Space for iOS'],
  ])

export const DEVICE_AUTHORIZATION_CLIENT_IDS: ReadonlySet<string> = new Set(
  DEVICE_AUTHORIZATION_CLIENT_NAMES.keys(),
)
