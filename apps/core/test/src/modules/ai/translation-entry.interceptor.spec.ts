import { describe, expect, it, vi } from 'vitest'

import { TranslationEntryInterceptor } from '~/common/interceptors/translation-entry.interceptor'

// Test the private path resolution logic by instantiating with null deps
// and calling the methods via prototype
const interceptor = Object.create(TranslationEntryInterceptor.prototype)

describe('TranslationEntryInterceptor path utilities', () => {
  describe('applyTranslations', () => {
    it('should batch lookup once and replace matched fields', async () => {
      const translationEntryService = {
        getTranslationsBatch: vi.fn().mockResolvedValue({
          entityMaps: new Map([
            ['category.name', new Map([['id-1', 'Frontend']])],
          ]),
          dictMaps: new Map([['note.mood', new Map([['开心', 'Happy']])]]),
        }),
      }

      const realInterceptor = new TranslationEntryInterceptor(
        { get: vi.fn() } as any,
        translationEntryService as any,
      )

      const data = {
        categories: [{ _id: 'id-1', name: '前端' }],
        notes: [{ mood: '开心' }],
      }

      const result = await realInterceptor['applyTranslations'](
        data,
        [
          {
            keyPath: 'category.name',
            path: 'categories[].name',
            idField: '_id',
          },
          { keyPath: 'note.mood', path: 'notes[].mood' },
        ],
        'en',
      )

      expect(
        translationEntryService.getTranslationsBatch,
      ).toHaveBeenCalledTimes(1)
      expect(translationEntryService.getTranslationsBatch).toHaveBeenCalledWith(
        'en',
        {
          entityLookups: [{ keyPath: 'category.name', lookupKeys: ['id-1'] }],
          dictLookups: [{ keyPath: 'note.mood', sourceTexts: ['开心'] }],
        },
      )
      expect(result).not.toBe(data)
      expect(result.categories[0].name).toBe('Frontend')
      expect(result.notes[0].mood).toBe('Happy')
      expect(data.categories[0].name).toBe('前端')
      expect(data.notes[0].mood).toBe('开心')
    })

    it('should clone non-structured-cloneable payloads safely', async () => {
      const translationEntryService = {
        getTranslationsBatch: vi.fn().mockResolvedValue({
          entityMaps: new Map(),
          dictMaps: new Map([['note.mood', new Map([['开心', 'Happy']])]]),
        }),
      }

      const realInterceptor = new TranslationEntryInterceptor(
        { get: vi.fn() } as any,
        translationEntryService as any,
      )

      const data = {
        notes: [{ mood: '开心', meta: { formatter: () => 'ok' } }],
      }

      const result = await realInterceptor['applyTranslations'](
        data,
        [{ keyPath: 'note.mood', path: 'notes[].mood' }],
        'en',
      )

      expect(result.notes[0].mood).toBe('Happy')
      expect(typeof result.notes[0].meta.formatter).toBe('function')
      expect(data.notes[0].mood).toBe('开心')
    })
  })

  describe('parsePathSegments', () => {
    const parse = interceptor['parsePathSegments'].bind(interceptor)

    it('should parse simple path', () => {
      const { parentSegments, field } = parse('categories[].name')
      expect(parentSegments).toEqual(['categories', '[]'])
      expect(field).toBe('name')
    })

    it('should parse nested path', () => {
      const { parentSegments, field } = parse('data.notes[].mood')
      expect(parentSegments).toEqual(['data', 'notes', '[]'])
      expect(field).toBe('mood')
    })

    it('should parse deep nested without array', () => {
      const { parentSegments, field } = parse('data.topic.name')
      expect(parentSegments).toEqual(['data', 'topic'])
      expect(field).toBe('name')
    })

    it('should parse single field', () => {
      const { parentSegments, field } = parse('mood')
      expect(parentSegments).toEqual([])
      expect(field).toBe('mood')
    })
  })

  describe('resolvePath', () => {
    const resolve = interceptor['resolvePath'].bind(interceptor)

    it('should resolve array path', () => {
      const data = { categories: [{ name: 'A' }, { name: 'B' }] }
      const result = resolve(data, ['categories', '[]'])
      expect(result).toEqual([{ name: 'A' }, { name: 'B' }])
    })

    it('should resolve nested path', () => {
      const data = { data: { notes: [{ mood: 'happy' }] } }
      const result = resolve(data, ['data', 'notes', '[]'])
      expect(result).toEqual([{ mood: 'happy' }])
    })

    it('should return empty for missing path', () => {
      const data = { foo: 'bar' }
      const result = resolve(data, ['missing', '[]'])
      expect(result).toEqual([])
    })

    it('should handle null gracefully', () => {
      const result = resolve(null, ['a', 'b'])
      expect(result).toEqual([])
    })
  })

  describe('deepClone', () => {
    const clone = interceptor['deepClone'].bind(interceptor)

    it('should clone plain objects', () => {
      const obj = { a: 1, b: { c: 2 } }
      const cloned = clone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.b).not.toBe(obj.b)
    })

    it('should preserve Date instances', () => {
      const d = new Date('2024-01-01')
      const obj = { created: d }
      const cloned = clone(obj)
      expect(cloned.created).toBeInstanceOf(Date)
      expect(cloned.created.getTime()).toBe(d.getTime())
      expect(cloned.created).not.toBe(d)
    })

    it('should preserve ObjectId-like objects', () => {
      const oid = {
        toHexString: () => '507f1f77bcf86cd799439011',
        toString: () => '507f1f77bcf86cd799439011',
      }
      const obj = { _id: oid }
      const cloned = clone(obj)
      expect(cloned._id).toBe(oid) // same reference, not cloned
    })

    it('should clone arrays', () => {
      const arr = [{ a: 1 }, { b: 2 }]
      const cloned = clone(arr)
      expect(cloned).toEqual(arr)
      expect(cloned[0]).not.toBe(arr[0])
    })

    it('should handle null and primitives', () => {
      expect(clone(null)).toBeNull()
      expect(clone(42)).toBe(42)
      expect(clone('hello')).toBe('hello')
    })
  })

  describe('collectDictTexts', () => {
    const collect = interceptor['collectDictTexts'].bind(interceptor)

    it('should collect texts from array items', () => {
      const data = { notes: [{ mood: '开心' }, { mood: '' }, { mood: '伤心' }] }
      const texts = new Set<string>()
      collect(data, 'notes[].mood', texts)
      expect([...texts]).toEqual(['开心', '伤心'])
    })

    it('should handle missing paths', () => {
      const data = { posts: [] }
      const texts = new Set<string>()
      collect(data, 'notes[].mood', texts)
      expect(texts.size).toBe(0)
    })
  })

  describe('collectEntityIds', () => {
    const collect = interceptor['collectEntityIds'].bind(interceptor)

    it('should collect ids from array items', () => {
      const data = {
        categories: [
          { _id: 'id-1', name: '前端' },
          { _id: 'id-2', name: '后端' },
        ],
      }
      const ids = new Set<string>()
      collect(data, 'categories[].name', '_id', ids)
      expect([...ids]).toEqual(['id-1', 'id-2'])
    })
  })

  describe('replaceDictValues', () => {
    const replace = interceptor['replaceDictValues'].bind(interceptor)

    it('should replace matching values', () => {
      const data = {
        notes: [{ mood: '开心' }, { mood: '伤心' }, { mood: null }],
      }
      const map = new Map([['开心', 'Happy']])
      replace(data, 'notes[].mood', map)
      expect(data.notes[0].mood).toBe('Happy')
      expect(data.notes[1].mood).toBe('伤心') // no translation
      expect(data.notes[2].mood).toBeNull()
    })
  })

  describe('replaceEntityValues', () => {
    const replace = interceptor['replaceEntityValues'].bind(interceptor)

    it('should replace by entity id', () => {
      const data = {
        categories: [
          { _id: 'id-1', name: '前端' },
          { _id: 'id-2', name: '后端' },
        ],
      }
      const map = new Map([['id-1', 'Frontend']])
      replace(data, 'categories[].name', '_id', map)
      expect(data.categories[0].name).toBe('Frontend')
      expect(data.categories[1].name).toBe('后端')
    })
  })
})
