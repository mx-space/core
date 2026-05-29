import { Logger } from '@nestjs/common'
import { Value } from 'typebox/value'
import { describe, expect, it, vi } from 'vitest'

import { convert } from '~/modules/ai/runtime/json-schema-to-typebox'

const insertNodeSchema = {
  type: 'object',
  properties: {
    position: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['after', 'before', 'root'] },
        blockId: { type: 'string' },
        index: { type: 'number' },
      },
      required: ['type'],
    },
    xml: {
      type: 'string',
      description: 'XML string containing block elements to insert',
    },
  },
  required: ['position', 'xml'],
}

const replaceNodeSchema = {
  type: 'object',
  properties: {
    blockId: { type: 'string' },
    xml: {
      type: 'string',
      description: 'XML string containing one block element',
    },
  },
  required: ['blockId', 'xml'],
}

const deleteNodeSchema = {
  type: 'object',
  properties: { blockId: { type: 'string' } },
  required: ['blockId'],
}

const searchDocumentSchema = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    blockType: { type: 'string' },
  },
  required: ['query'],
}

describe('json-schema-to-typebox.convert', () => {
  describe('haklex document-tools fixtures', () => {
    it('converts insert_node schema and validates sample args', () => {
      const t = convert(insertNodeSchema, { toolName: 'insert_node' })
      expect(
        Value.Check(t, {
          position: { type: 'after', blockId: 'b1' },
          xml: '<p>hi</p>',
        }),
      ).toBe(true)
      expect(
        Value.Check(t, { position: { type: 'root' }, xml: '<p>x</p>' }),
      ).toBe(true)
      expect(Value.Check(t, { position: { type: 'after' } })).toBe(false)
    })

    it('converts replace_node schema and validates sample args', () => {
      const t = convert(replaceNodeSchema, { toolName: 'replace_node' })
      expect(Value.Check(t, { blockId: 'b1', xml: '<p>x</p>' })).toBe(true)
      expect(Value.Check(t, { xml: '<p>x</p>' })).toBe(false)
    })

    it('converts delete_node schema and validates sample args', () => {
      const t = convert(deleteNodeSchema, { toolName: 'delete_node' })
      expect(Value.Check(t, { blockId: 'b1' })).toBe(true)
      expect(Value.Check(t, {})).toBe(false)
    })

    it('converts search_document schema and validates sample args', () => {
      const t = convert(searchDocumentSchema, { toolName: 'search_document' })
      expect(Value.Check(t, { query: 'hello' })).toBe(true)
      expect(Value.Check(t, { query: 'hi', blockType: 'paragraph' })).toBe(true)
      expect(Value.Check(t, { blockType: 'paragraph' })).toBe(false)
    })
  })

  describe('unsupported keyword fallback', () => {
    it('falls back to Type.Unsafe for format: uuid and logs warning', () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {})
      try {
        const t = convert({ type: 'string', format: 'uuid' } as any, {
          toolName: 'fmt',
        })
        expect((t as any)['~unsafe']).toBe(null)
        expect((t as any).type).toBe('string')
        expect((t as any).format).toBe('uuid')
        expect(warn).toHaveBeenCalled()
        const msg = warn.mock.calls.map((c) => String(c[0])).join('\n')
        expect(msg).toContain('format')
        expect(msg).toContain('fmt')
      } finally {
        warn.mockRestore()
      }
    })

    it('falls back to Type.Unsafe for $ref and logs warning', () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {})
      try {
        const t = convert({ $ref: '#/definitions/Foo' } as any, {
          toolName: 'ref',
        })
        expect((t as any)['~unsafe']).toBe(null)
        expect((t as any).$ref).toBe('#/definitions/Foo')
        expect(warn).toHaveBeenCalled()
        const msg = warn.mock.calls.map((c) => String(c[0])).join('\n')
        expect(msg).toContain('$ref')
      } finally {
        warn.mockRestore()
      }
    })
  })
})
