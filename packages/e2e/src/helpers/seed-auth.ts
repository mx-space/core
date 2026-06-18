import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { hashPassword } from 'better-auth/crypto'

import { API_VERSION } from '~/app.config'

import { ownerFixture } from '../fixtures/owner'
import type { E2EBackend } from './e2e-app'

export interface SeededOwner {
  email: string
  password: string
  username: string
  userId: string
  bearerToken: string
  approvalHeaders: Headers
}

export async function seedOwnerAndWriteProfile(
  backend: E2EBackend,
  opts: { profile: string; tmpHome: string; suffix?: string },
): Promise<SeededOwner> {
  const suffix = opts.suffix ?? randomUUID().replaceAll('-', '').slice(0, 8)
  const userId = `usr_${suffix}`
  const accountId = `acc_${suffix}`
  const email = `${suffix}.${ownerFixture.email}`
  const username = `${ownerFixture.username}_${suffix}`
  const password = ownerFixture.password
  const now = new Date()
  const passwordHash = await hashPassword(password)

  await backend.pgPool.query(
    `
      INSERT INTO readers (
        id, created_at, updated_at, email, email_verified,
        name, username, display_username, role
      )
      VALUES ($1, $2, $2, $3, true, $4, $5, $5, 'owner')
    `,
    [userId, now, email, 'E2E Owner', username],
  )

  await backend.pgPool.query(
    `
      INSERT INTO accounts (
        id, created_at, updated_at, user_id, account_id,
        provider_id, provider_account_id, password, type
      )
      VALUES ($1, $2, $2, $3, $3, 'credential', $3, $4, 'credential')
    `,
    [accountId, now, userId, passwordHash],
  )

  const signIn = await backend.authApi.signInUsername({
    body: { username, password },
    returnHeaders: true,
  })

  const headers = new Headers()
  const setCookie = signIn.headers?.get?.('set-cookie')
  if (setCookie) headers.set('cookie', setCookie)

  const token =
    signIn.headers?.get?.('set-auth-token') ||
    signIn.response?.token ||
    signIn.response?.session?.token
  if (!token) {
    throw new Error(`failed to mint owner bearer token for ${username}`)
  }

  writeProfile(opts.tmpHome, opts.profile, {
    apiUrl: backend.apiBase,
    token,
    user: {
      id: userId,
      email,
      name: 'E2E Owner',
    },
  })

  return {
    email,
    password,
    username,
    userId,
    bearerToken: token,
    approvalHeaders: headers,
  }
}

export function writeProfile(
  tmpHome: string,
  profile: string,
  input: {
    apiUrl: string
    token: string
    user: { id: string; email: string; name: string }
  },
) {
  const mxsDir = join(tmpHome, 'mxs')
  const profileDir = join(mxsDir, 'profiles', profile)
  mkdirSync(profileDir, { recursive: true, mode: 0o700 })

  writeFileSync(
    join(profileDir, 'config.json'),
    `${JSON.stringify(
      {
        api_url: input.apiUrl,
        api_version: API_VERSION,
        production: false,
      },
      null,
      2,
    )}\n`,
    { mode: 0o644 },
  )

  writeFileSync(
    join(profileDir, 'credentials.json'),
    `${JSON.stringify(
      {
        access_token: input.token,
        expires_at: Date.now() + 14 * 24 * 60 * 60 * 1000,
        user: input.user,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  )

  writeFileSync(join(mxsDir, 'current'), `${profile}\n`, { mode: 0o644 })
}
