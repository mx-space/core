import { describe, expect, it } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import {
  getPersonaDefinition,
  isKnownPersonaKey,
  listPersonas,
  PERSONA_REGISTRY,
  tryGetPersonaDefinition,
} from '~/modules/ai/ai-persona/persona-registry'

describe('persona-registry', () => {
  it('exposes inner-self with profile/retrieval/exemplar capabilities', () => {
    const def = PERSONA_REGISTRY['inner-self']
    expect(def).toBeDefined()
    expect(def.key).toBe('inner-self')
    expect(def.needsProfile).toBe(true)
    expect(def.needsRetrieval).toBe(true)
    expect(def.usesExemplars).toBe(true)
    expect(def.staticPrompt.length).toBeGreaterThan(0)
  })

  it('exposes passerby as fully fixed', () => {
    const def = PERSONA_REGISTRY.passerby
    expect(def.needsProfile).toBe(false)
    expect(def.needsRetrieval).toBe(false)
    expect(def.usesExemplars).toBe(false)
    expect(def.staticPrompt.length).toBeGreaterThan(0)
  })

  it('list returns both shipped personas', () => {
    const list = listPersonas()
    const keys = list.map((p) => p.key)
    expect(keys).toContain('inner-self')
    expect(keys).toContain('passerby')
  })

  it('isKnownPersonaKey gates on the registry', () => {
    expect(isKnownPersonaKey('inner-self')).toBe(true)
    expect(isKnownPersonaKey('passerby')).toBe(true)
    expect(isKnownPersonaKey('ghost')).toBe(false)
  })

  it('tryGetPersonaDefinition returns undefined for unknown keys', () => {
    expect(tryGetPersonaDefinition('unknown-key')).toBeUndefined()
  })

  it('getPersonaDefinition throws AI_PERSONA_NOT_FOUND for unknown key', () => {
    try {
      getPersonaDefinition('does-not-exist')
      expect.fail('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppException)
      expect((error as AppException).code).toBe(
        AppErrorCode.AI_PERSONA_NOT_FOUND,
      )
    }
  })
})
