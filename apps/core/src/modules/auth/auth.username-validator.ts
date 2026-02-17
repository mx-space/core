const usernamePattern = /^[\w.-]+$/

export const validateMxUsername = (username: string) => {
  return usernamePattern.test(username)
}
