import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../../src/helpers/e2e-app'
import {
  extractId,
  getItems,
  parseEnvelope,
  runMxs,
} from '../../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs comment moderation against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome
  let postId: string
  let categoryName: string

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'comment-moderate',
      tmpHome: tmpHome.path,
    })

    categoryName = `E2E Comment Cat ${Date.now()}`
    const catSlug = `e2e-comment-cat-${Date.now()}`

    const catResult = await runMxs(
      [
        '--json',
        'category',
        'create',
        '--name',
        categoryName,
        '--slug',
        catSlug,
      ],
      {
        XDG_CONFIG_HOME: tmpHome.path,
        MXS_PROFILE: 'comment-moderate',
      },
    )
    if (catResult.code !== 0) {
      throw new Error(
        `category create failed: ${catResult.stderr || catResult.stdout}`,
      )
    }

    const postResult = await runMxs(
      [
        '--json',
        'post',
        'create',
        '--title',
        'comment-moderate-target',
        '--slug',
        `comment-target-${Date.now()}`,
        '--category',
        categoryName,
        '--format',
        'markdown',
        '--content',
        'target post for comment tests',
      ],
      {
        XDG_CONFIG_HOME: tmpHome.path,
        MXS_PROFILE: 'comment-moderate',
      },
    )
    if (postResult.code !== 0) {
      throw new Error(
        `post create failed: ${postResult.stderr || postResult.stdout}`,
      )
    }
    postId = extractId(parseEnvelope(postResult.stdout).data)
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'comment-moderate',
  })

  const submitGuestComment = async (text: string): Promise<string> => {
    const res = await backend.app.inject({
      method: 'POST',
      url: `/api/v3/comments/guest/${postId}?ref=post`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        author: 'e2e-guest',
        text,
        mail: 'e2e@example.com',
      }),
    })
    if (res.statusCode >= 300) {
      throw new Error(
        `guest comment submit failed (${res.statusCode}): ${res.body}`,
      )
    }
    return extractId(JSON.parse(res.body).data ?? JSON.parse(res.body))
  }

  it('lists, approves, rejects, and deletes comments', async () => {
    const commentId1 = await submitGuestComment('e2e comment alpha')
    const commentId2 = await submitGuestComment('e2e comment beta')

    const listed = await runMxs(['--json', 'comment', 'list'], env())
    expect(listed.code, listed.stderr || listed.stdout).toBe(0)
    const listedIds = getItems(parseEnvelope(listed.stdout).data).map((item) =>
      extractId(item),
    )
    expect(listedIds).toContain(commentId1)
    expect(listedIds).toContain(commentId2)

    const approved = await runMxs(
      ['--json', 'comment', 'approve', commentId1],
      env(),
    )
    expect(approved.code, approved.stderr || approved.stdout).toBe(0)

    const afterApprove = await runMxs(
      ['--json', 'comment', 'list', '--state', 'read'],
      env(),
    )
    expect(afterApprove.code, afterApprove.stderr || afterApprove.stdout).toBe(
      0,
    )
    const readIds = getItems(parseEnvelope(afterApprove.stdout).data).map(
      (item) => extractId(item),
    )
    expect(readIds).toContain(commentId1)

    const rejected = await runMxs(
      ['--json', 'comment', 'reject', commentId2],
      env(),
    )
    expect(rejected.code, rejected.stderr || rejected.stdout).toBe(0)

    const afterReject = await runMxs(
      ['--json', 'comment', 'list', '--state', 'junk'],
      env(),
    )
    expect(afterReject.code, afterReject.stderr || afterReject.stdout).toBe(0)
    const junkIds = getItems(parseEnvelope(afterReject.stdout).data).map(
      (item) => extractId(item),
    )
    expect(junkIds).toContain(commentId2)

    const del1 = await runMxs(
      ['--json', 'comment', 'delete', commentId1, '--force'],
      env(),
    )
    expect(del1.code, del1.stderr || del1.stdout).toBe(0)

    const del2 = await runMxs(
      ['--json', 'comment', 'delete', commentId2, '--force'],
      env(),
    )
    expect(del2.code, del2.stderr || del2.stdout).toBe(0)
  }, 90_000)
})
