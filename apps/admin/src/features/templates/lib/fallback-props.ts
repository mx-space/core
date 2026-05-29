import type { TemplateType } from '../types/templates'

const sharedPostProps = {
  id: 'cdab54a19f3f03f7f5159df7',
  title: 'A Tale of Two Cities',
  text: 'It was the best of times, it was the worst of times.',
  created: '2024-01-01T00:00:00.000Z',
}

const sharedOwner = {
  name: 'Owner',
  username: 'owner',
  avatar: 'https://placehold.co/96x96',
  mail: 'owner@example.com',
  url: 'https://example.com',
}

export const templateFallbackProps: Record<
  TemplateType,
  Record<string, unknown>
> = {
  guest: {
    author: 'Alice',
    mail: 'alice@example.com',
    text: 'Looks great!',
    link: 'https://example.com/post#comment-1',
    ip: '127.0.0.1',
    date: '2024-01-01',
    master: sharedOwner.name,
    post: {
      title: sharedPostProps.title,
      url: 'https://example.com/post',
    },
    parent: {
      author: sharedOwner.name,
      text: 'Original comment from owner',
    },
  },
  owner: {
    author: 'Alice',
    mail: 'alice@example.com',
    text: 'Looks great!',
    link: 'https://example.com/post#comment-1',
    ip: '127.0.0.1',
    date: '2024-01-01',
    master: sharedOwner.name,
    post: {
      title: sharedPostProps.title,
      url: 'https://example.com/post',
    },
    parent: null,
  },
  newsletter: {
    title: sharedPostProps.title,
    text: sharedPostProps.text,
    author: 'Alice',
    owner: sharedOwner.name,
    detail_link: 'https://example.com/post',
    unsubscribe_link: 'https://example.com/unsubscribe',
    aggregate: {
      owner: sharedOwner,
      subscriber: {
        email: 'subscriber@example.com',
        subscribe: 0,
      },
      post: sharedPostProps,
    },
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/**
 * Recursively merge `overrides` into `base`. Arrays and primitives in `overrides`
 * replace those in `base`. Objects merge key-by-key. Used to supplement
 * partial backend props with our admin-side fallback so previews don't blow up
 * on missing keys.
 */
export function mergeFallbackProps(
  base: Record<string, unknown>,
  overrides: unknown,
): Record<string, unknown> {
  if (!isPlainObject(overrides)) return { ...base }
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key]
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeFallbackProps(current, value)
    } else {
      result[key] = value
    }
  }
  return result
}
