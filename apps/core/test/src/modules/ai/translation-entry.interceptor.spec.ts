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
      expect(result).toBe(data)
      expect(result.categories[0].name).toBe('Frontend')
      expect(result.notes[0].mood).toBe('Happy')
      expect(data.categories[0].name).toBe('Frontend')
      expect(data.notes[0].mood).toBe('Happy')
    })

    it('should translate entity fields on root arrays', async () => {
      const translationEntryService = {
        getTranslationsBatch: vi.fn().mockResolvedValue({
          entityMaps: new Map([
            ['topic.name', new Map([['id-1', 'Frontend']])],
          ]),
          dictMaps: new Map(),
        }),
      }

      const realInterceptor = new TranslationEntryInterceptor(
        { get: vi.fn() } as any,
        translationEntryService as any,
      )

      const data = [{ _id: 'id-1', name: '前端' }]

      const result = await realInterceptor['applyTranslations'](
        data,
        [
          {
            keyPath: 'topic.name',
            path: '[].name',
            idField: '_id',
          },
        ],
        'en',
      )

      expect(translationEntryService.getTranslationsBatch).toHaveBeenCalledWith(
        'en',
        {
          entityLookups: [{ keyPath: 'topic.name', lookupKeys: ['id-1'] }],
          dictLookups: [],
        },
      )
      expect(result).toBe(data)
      expect(result[0].name).toBe('Frontend')
      expect(data[0].name).toBe('Frontend')
    })

    it('should translate document-like values in place', async () => {
      const translationEntryService = {
        getTranslationsBatch: vi.fn().mockResolvedValue({
          entityMaps: new Map([
            ['category.name', new Map([['id-1', 'Frontend']])],
          ]),
          dictMaps: new Map(),
        }),
      }

      const realInterceptor = new TranslationEntryInterceptor(
        { get: vi.fn() } as any,
        translationEntryService as any,
      )

      class CategoryDoc {
        _id = 'id-1'
        name = '前端'
        self = this

        toJSON() {
          return {
            _id: this._id,
            name: this.name,
          }
        }
      }

      const data = {
        categories: [new CategoryDoc()],
      }

      const result = await realInterceptor['applyTranslations'](
        data,
        [
          {
            keyPath: 'category.name',
            path: 'categories[].name',
            idField: '_id',
          },
        ],
        'en',
      )

      expect(result.categories[0].name).toBe('Frontend')
      expect(result.categories[0]._id).toBe('id-1')
    })

    it('should preserve non-structured-cloneable payloads when translating', async () => {
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

      expect(result).toBe(data)
      expect(result.notes[0].mood).toBe('Happy')
      expect(typeof result.notes[0].meta.formatter).toBe('function')
      expect(data.notes[0].mood).toBe('Happy')
    })
  })

  describe('toObjectScanPath', () => {
    const normalize = interceptor['toObjectScanPath'].bind(interceptor)

    it('should normalize root array path', () => {
      expect(normalize('[].name')).toBe('[*].name')
    })

    it('should normalize simple array path', () => {
      expect(normalize('categories[].name')).toBe('categories[*].name')
    })

    it('should normalize nested array path', () => {
      expect(normalize('data.notes[].mood')).toBe('data.notes[*].mood')
    })

    it('should preserve plain object path', () => {
      expect(normalize('data.topic.name')).toBe('data.topic.name')
    })

    it('should preserve single field', () => {
      expect(normalize('mood')).toBe('mood')
    })
  })

  describe('toScannableObject', () => {
    const toScannableObject =
      interceptor['toScannableObject']?.bind(interceptor)

    it('should keep plain objects by reference', () => {
      const data = { notes: [{ mood: '开心' }] }
      expect(toScannableObject(data)).toBe(data)
    })

    it('should keep arrays by reference', () => {
      const data = [{ mood: '开心' }]
      expect(toScannableObject(data)).toBe(data)
    })

    it('should prefer toJSON for document-like objects', () => {
      const jsonData = { notes: [{ mood: '开心' }] }
      class MockDoc {
        toJSON = vi.fn(() => jsonData)
        toObject = vi.fn(() => ({ notes: [{ mood: 'ignored' }] }))
      }
      const data = new MockDoc()

      expect(toScannableObject(data)).toBe(jsonData)
      expect(data.toJSON).toHaveBeenCalledOnce()
      expect(data.toObject).not.toHaveBeenCalled()
    })

    it('should fall back to toObject when toJSON is unavailable', () => {
      const objectData = { notes: [{ mood: '开心' }] }
      class MockDoc {
        toObject = vi.fn(() => objectData)
      }
      const data = new MockDoc()

      expect(toScannableObject(data)).toBe(objectData)
      expect(data.toObject).toHaveBeenCalledOnce()
    })

    it('should recursively normalize document-like values nested under plain objects', () => {
      class TopicDoc {
        toJSON = vi.fn(() => ({ _id: 'topic-1', name: '近况' }))
      }

      class NoteDoc {
        toJSON = vi.fn(() => ({
          _id: 'note-1',
          mood: '开心',
          topic: new TopicDoc(),
        }))
      }

      const data = { docs: [new NoteDoc()] }
      const result = toScannableObject(data)

      expect(result).not.toBe(data)
      expect(result.docs[0]).toEqual({
        _id: 'note-1',
        mood: '开心',
        topic: { _id: 'topic-1', name: '近况' },
      })
    })
  })

  describe('collectDictTexts', () => {
    const collect = interceptor['collectDictTexts'].bind(interceptor)

    it('should collect texts from array items', () => {
      const data = { notes: [{ mood: '开心' }, { mood: '' }, { mood: '伤心' }] }
      const texts = new Set<string>()
      collect(data, 'notes[].mood', texts)
      expect([...texts].sort()).toEqual(['伤心', '开心'])
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
      expect([...ids].sort()).toEqual(['id-1', 'id-2'])
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
