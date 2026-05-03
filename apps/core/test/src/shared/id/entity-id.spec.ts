import {
  ENTITY_ID_MAX_BIGINT,
  isEntityIdString,
  parseEntityId,
  serializeEntityId,
  tryParseEntityId,
  zEntityId,
  zEntityIdOrInt,
} from '~/shared/id/entity-id'

describe('entity-id', () => {
  describe('isEntityIdString', () => {
    it('accepts decimal strings within bigint range', () => {
      expect(isEntityIdString('1')).toBe(true)
      expect(isEntityIdString('1746144000000')).toBe(true)
      expect(isEntityIdString(ENTITY_ID_MAX_BIGINT.toString())).toBe(true)
    })

    it('rejects zero, negatives, and leading zeros', () => {
      expect(isEntityIdString('0')).toBe(false)
      expect(isEntityIdString('-1')).toBe(false)
      expect(isEntityIdString('01')).toBe(false)
    })

    it('rejects hex/non-decimal/empty/non-string input', () => {
      expect(isEntityIdString('abc')).toBe(false)
      expect(isEntityIdString('507f1f77bcf86cd799439011')).toBe(false)
      expect(isEntityIdString('')).toBe(false)
      expect(isEntityIdString(123 as unknown)).toBe(false)
      expect(isEntityIdString(null)).toBe(false)
    })

    it('rejects values exceeding bigint range', () => {
      const tooBig = (ENTITY_ID_MAX_BIGINT + 1n).toString()
      expect(isEntityIdString(tooBig)).toBe(false)
    })
  })

  describe('parseEntityId / serializeEntityId', () => {
    it('round-trips bigint and decimal string', () => {
      const big = 7311432189440016384n
      expect(serializeEntityId(big)).toBe(big.toString())
      expect(parseEntityId(big.toString())).toBe(big)
    })

    it('rejects non-string input on parse', () => {
      // @ts-expect-error – run-time check
      expect(() => parseEntityId(123)).toThrow(TypeError)
    })

    it('rejects out-of-range bigint on serialize', () => {
      expect(() => serializeEntityId(0n)).toThrow()
      expect(() => serializeEntityId(-1n)).toThrow()
      expect(() => serializeEntityId(ENTITY_ID_MAX_BIGINT + 1n)).toThrow()
    })
  })

  describe('tryParseEntityId', () => {
    it('reports ok=true for valid input', () => {
      const res = tryParseEntityId('42')
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.value).toBe(42n)
    })

    it('reports ok=false for invalid input without throwing', () => {
      expect(tryParseEntityId('abc')).toEqual({ ok: false })
      expect(tryParseEntityId('0')).toEqual({ ok: false })
      expect(tryParseEntityId(123)).toEqual({ ok: false })
    })
  })

  describe('zod schemas', () => {
    it('zEntityId parses valid decimal string', () => {
      const result = zEntityId.parse('1746144000000')
      expect(result).toBe('1746144000000')
    })

    it('zEntityId rejects ObjectId-like input', () => {
      expect(() => zEntityId.parse('507f1f77bcf86cd799439011')).toThrow()
    })

    it('zEntityIdOrInt accepts both kinds', () => {
      expect(zEntityIdOrInt.parse('99')).toBe('99')
      expect(zEntityIdOrInt.parse(99)).toBe(99)
    })
  })
})
