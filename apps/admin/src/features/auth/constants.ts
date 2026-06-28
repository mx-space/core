import { adminQueryKeys } from '~/query/keys'

export const allowLoginQueryKey = adminQueryKeys.login.allowLogin()
export const loggedStatusQueryKey = adminQueryKeys.auth.loggedStatus()
export const initQueryKey = adminQueryKeys.login.init()
export const ownerQueryKey = adminQueryKeys.login.owner()
