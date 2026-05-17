import { describe, expect, it } from 'vitest'

import {
  applyNoteEnvelopeMeta,
  applyPageEnvelopeMeta,
} from '../../src/commands/_envelope-overlays'

describe('editor envelope metadata overlays', () => {
  it('applies edited note metadata to the update payload', () => {
    const payload: Record<string, unknown> = {
      content: '{}',
      contentFormat: 'lexical',
      text: 'body',
      title: 'old',
    }

    applyNoteEnvelopeMeta(payload, {
      title: 'new title',
      slug: 'new-slug',
      state: 'draft',
      mood: 'focused',
      weather: 'clear',
    })

    expect(payload).toMatchObject({
      title: 'new title',
      slug: 'new-slug',
      isPublished: false,
      mood: 'focused',
      weather: 'clear',
    })
  })

  it('applies edited page metadata to the update payload', () => {
    const payload: Record<string, unknown> = {
      content: '{}',
      contentFormat: 'lexical',
      text: 'body',
    }

    applyPageEnvelopeMeta(payload, {
      title: 'About',
      slug: 'about',
      subtitle: 'Profile',
      order: '3',
    })

    expect(payload).toMatchObject({
      title: 'About',
      slug: 'about',
      subtitle: 'Profile',
      order: 3,
    })
  })
})
