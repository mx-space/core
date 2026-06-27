import { createHash } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { CategoryService } from '~/modules/category/category.service'
import { NoteService } from '~/modules/note/note.service'
import { TopicRepository } from '~/modules/topic/topic.repository'
import { RedisService } from '~/processors/redis/redis.service'
import { normalizeLanguageCode } from '~/utils/lang.util'
import { getRedisKey } from '~/utils/redis.util'

import { ConfigsService } from '../../configs/configs.service'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { TranslationEntryRepository } from './ai-translation.repository'
import {
  type TranslationEntryKeyPath,
  type TranslationEntryKeyType,
  TranslationEntryModel,
} from './translation-entry.types'

interface CollectedValue {
  keyPath: TranslationEntryKeyPath
  keyType: TranslationEntryKeyType
  lookupKey: string
  sourceText: string
}

interface TranslationBatchEntityLookup {
  keyPath: TranslationEntryKeyPath
  lookupKeys: Iterable<string>
}

interface TranslationBatchDictLookup {
  keyPath: TranslationEntryKeyPath
  sourceTexts: Iterable<string>
}

interface TranslationBatchLookup {
  keyPath: TranslationEntryKeyPath
  keyType: TranslationEntryKeyType
  lookupKeys: string[]
}

interface TranslationBatchResult {
  entityMaps: Map<TranslationEntryKeyPath, Map<string, string>>
  dictMaps: Map<TranslationEntryKeyPath, Map<string, string>>
}

type DictCacheEntry = Pick<
  TranslationEntryModel,
  'keyPath' | 'lang' | 'lookupKey' | 'translatedText'
>

@Injectable()
export class TranslationEntryService {
  private readonly logger = new Logger(TranslationEntryService.name)
  private static readonly DICT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7

  constructor(
    private readonly entryRepository: TranslationEntryRepository,
    private readonly categoryService: CategoryService,
    private readonly noteService: NoteService,
    private readonly topicRepository: TopicRepository,
    private readonly aiService: AiService,
    private readonly configService: ConfigsService,
    private readonly redisService: RedisService,
  ) {}

  static hashSourceText(text: string): string {
    return createHash('sha256').update(text.trim().toLowerCase()).digest('hex')
  }

  async getTranslations(
    keyPath: TranslationEntryKeyPath,
    lang: string,
    lookupKeys: string[],
  ): Promise<Map<string, string>> {
    const { entityMaps } = await this.getTranslationsBatch(lang, {
      entityLookups: [{ keyPath, lookupKeys }],
    })

    return entityMaps.get(keyPath) ?? new Map()
  }

  async getTranslationsForDict(
    keyPath: TranslationEntryKeyPath,
    lang: string,
    sourceTexts: string[],
  ): Promise<Map<string, string>> {
    const { dictMaps } = await this.getTranslationsBatch(lang, {
      dictLookups: [{ keyPath, sourceTexts }],
    })

    return dictMaps.get(keyPath) ?? new Map()
  }

  async getTranslationsBatch(
    lang: string,
    options: {
      entityLookups?: TranslationBatchEntityLookup[]
      dictLookups?: TranslationBatchDictLookup[]
    },
  ): Promise<TranslationBatchResult> {
    const entityMaps = new Map<TranslationEntryKeyPath, Map<string, string>>()
    const dictMaps = new Map<TranslationEntryKeyPath, Map<string, string>>()

    const dbLookups: TranslationBatchLookup[] = []
    const dictHashToTextMaps = new Map<
      TranslationEntryKeyPath,
      Map<string, string>
    >()

    for (const lookup of options.entityLookups ?? []) {
      const lookupKeys = [...new Set([...lookup.lookupKeys].filter(Boolean))]
      if (!lookupKeys.length) continue
      dbLookups.push({
        keyPath: lookup.keyPath,
        keyType: 'entity',
        lookupKeys,
      })
    }

    for (const lookup of options.dictLookups ?? []) {
      const uniqueTexts = [...new Set([...lookup.sourceTexts].filter(Boolean))]
      if (!uniqueTexts.length) continue

      const hashToText = new Map<string, string>()
      for (const text of uniqueTexts) {
        hashToText.set(TranslationEntryService.hashSourceText(text), text)
      }

      dictHashToTextMaps.set(lookup.keyPath, hashToText)

      const { cachedMap, missedLookupKeys } =
        await this.getCachedDictTranslations(lookup.keyPath, lang, hashToText)

      if (cachedMap.size) {
        dictMaps.set(lookup.keyPath, cachedMap)
      }

      if (missedLookupKeys.length) {
        dbLookups.push({
          keyPath: lookup.keyPath,
          keyType: 'dict',
          lookupKeys: missedLookupKeys,
        })
      }
    }

    if (!dbLookups.length) {
      return { entityMaps, dictMaps }
    }

    const entries = await this.entryRepository.listByBatch(
      lang,
      dbLookups.map((lookup) => ({
        keyPath: lookup.keyPath,
        keyType: lookup.keyType,
        lookupKeys: lookup.lookupKeys,
      })),
    )

    const dictCacheEntries: DictCacheEntry[] = []

    for (const entry of entries) {
      if (entry.keyType === 'entity') {
        let map = entityMaps.get(entry.keyPath)
        if (!map) {
          map = new Map<string, string>()
          entityMaps.set(entry.keyPath, map)
        }
        map.set(entry.lookupKey, entry.translatedText)
        continue
      }

      const hashToText = dictHashToTextMaps.get(entry.keyPath)
      const sourceText = hashToText?.get(entry.lookupKey)
      if (!sourceText) continue

      let map = dictMaps.get(entry.keyPath)
      if (!map) {
        map = new Map<string, string>()
        dictMaps.set(entry.keyPath, map)
      }

      map.set(sourceText, entry.translatedText)
      dictCacheEntries.push({
        keyPath: entry.keyPath,
        lang,
        lookupKey: entry.lookupKey,
        translatedText: entry.translatedText,
      })
    }

    await this.cacheDictTranslations(dictCacheEntries)

    return { entityMaps, dictMaps }
  }

  async collectSourceValues(): Promise<CollectedValue[]> {
    const values: CollectedValue[] = []

    const categories = await this.categoryService.findAllCategory()
    for (const cat of categories) {
      if (cat.name) {
        values.push({
          keyPath: 'category.name',
          keyType: 'entity',
          lookupKey: cat.id,
          sourceText: cat.name,
        })
      }
    }

    const topics = await this.topicRepository.findAll()
    for (const topic of topics) {
      if (topic.name) {
        values.push({
          keyPath: 'topic.name',
          keyType: 'entity',
          lookupKey: topic.id,
          sourceText: topic.name,
        })
      }
      if (topic.introduce) {
        values.push({
          keyPath: 'topic.introduce',
          keyType: 'entity',
          lookupKey: topic.id,
          sourceText: topic.introduce,
        })
      }
      if (topic.description) {
        values.push({
          keyPath: 'topic.description',
          keyType: 'entity',
          lookupKey: topic.id,
          sourceText: topic.description,
        })
      }
    }

    const { moods, weathers } =
      await this.noteService.findDistinctMoodsAndWeathers()
    for (const mood of moods) {
      values.push({
        keyPath: 'note.mood',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText(mood),
        sourceText: mood,
      })
    }
    for (const weather of weathers) {
      values.push({
        keyPath: 'note.weather',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText(weather),
        sourceText: weather,
      })
    }

    return values
  }

  async generateTranslations(options: {
    keyPaths?: TranslationEntryKeyPath[]
    targetLangs?: string[]
  }): Promise<{ created: number; skipped: number }> {
    const aiConfig = await this.configService.get('ai')
    const rawLangs = options.targetLangs?.length
      ? options.targetLangs
      : aiConfig.translationTargetLanguages || []

    const targetLangs = rawLangs
      .map((l) => normalizeLanguageCode(l))
      .filter(Boolean) as string[]

    if (!targetLangs.length) {
      return { created: 0, skipped: 0 }
    }

    let allValues = await this.collectSourceValues()
    if (options.keyPaths?.length) {
      allValues = allValues.filter((v) => options.keyPaths!.includes(v.keyPath))
    }

    if (!allValues.length) {
      return { created: 0, skipped: 0 }
    }

    return this.translateValuesForLangs(
      allValues,
      targetLangs,
      (lang) => this.entryRepository.listFiltered({ lang }),
      'Field translation failed',
    )
  }

  async generateForValues(
    values: CollectedValue[],
  ): Promise<{ created: number; skipped: number }> {
    if (!values.length) return { created: 0, skipped: 0 }

    const aiConfig = await this.configService.get('ai')
    const rawLangs = aiConfig.translationTargetLanguages || []
    const targetLangs = rawLangs
      .map((l) => normalizeLanguageCode(l))
      .filter(Boolean) as string[]

    if (!targetLangs.length) return { created: 0, skipped: 0 }

    return this.translateValuesForLangs(
      values,
      targetLangs,
      () =>
        this.entryRepository.listByKeyPathLookupKeys(
          values.map((v) => ({ keyPath: v.keyPath, lookupKey: v.lookupKey })),
        ),
      'Auto field translation failed',
    )
  }

  private async translateValuesForLangs(
    values: CollectedValue[],
    targetLangs: string[],
    fetchExisting: (
      lang: string,
    ) => Promise<
      Array<Pick<TranslationEntryModel, 'keyPath' | 'lookupKey' | 'sourceText'>>
    >,
    errorLabel: string,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0
    let skipped = 0

    for (const lang of targetLangs) {
      const dictCacheEntries: DictCacheEntry[] = []
      const existingEntries = await fetchExisting(lang)

      const existingMap = new Map(
        existingEntries.map((e) => [
          `${e.keyPath}:${e.lookupKey}`,
          e.sourceText,
        ]),
      )

      const toTranslate: CollectedValue[] = []
      for (const value of values) {
        const key = `${value.keyPath}:${value.lookupKey}`
        const existing = existingMap.get(key)
        if (existing === undefined || existing !== value.sourceText) {
          toTranslate.push(value)
        } else {
          skipped++
        }
      }

      if (!toTranslate.length) continue

      const fields: Record<string, string> = {}
      for (const item of toTranslate) {
        fields[`${item.keyPath}::${item.lookupKey}`] = item.sourceText
      }

      try {
        const runtime = await this.aiService.getTranslationModel()
        const promptData = AI_PROMPTS.fieldTranslation(lang, fields)
        const result = await runtime.generateStructured({
          prompt: promptData.prompt,
          systemPrompt: promptData.systemPrompt,
          schema: promptData.schema,
          reasoningEffort: promptData.reasoningEffort,
        })

        const translations = result.output.translations
        for (const item of toTranslate) {
          const compositeKey = `${item.keyPath}::${item.lookupKey}`
          const translatedText = translations[compositeKey]
          if (!translatedText) continue

          await this.entryRepository.upsert({
            keyPath: item.keyPath,
            lang,
            keyType: item.keyType,
            lookupKey: item.lookupKey,
            sourceText: item.sourceText,
            translatedText,
            sourceUpdatedAt: item.keyType === 'entity' ? new Date() : undefined,
          })

          if (item.keyType === 'dict') {
            dictCacheEntries.push({
              keyPath: item.keyPath,
              lang,
              lookupKey: item.lookupKey,
              translatedText,
            })
          }

          created++
        }

        await this.cacheDictTranslations(dictCacheEntries)
      } catch (error) {
        this.logger.error(
          `${errorLabel} for lang=${lang}: ${(error as Error).message}`,
        )
      }
    }

    return { created, skipped }
  }

  async handleEntityUpdate(
    keyPath: TranslationEntryKeyPath,
    refId: string,
    newSourceText: string,
  ): Promise<void> {
    if (!newSourceText) {
      await this.entryRepository.deleteByKeyPath(keyPath, refId)
      return
    }

    const existingEntries = await this.entryRepository.listByKeyPath(
      keyPath,
      refId,
    )

    if (!existingEntries.length) return

    const staleEntries = existingEntries.filter(
      (e) => e.sourceText !== newSourceText,
    )
    if (!staleEntries.length) return

    const staleLangs = staleEntries.map((e) => e.lang)
    await this.entryRepository.deleteMany({
      keyPath,
      lookupKey: refId,
      langs: staleLangs,
    })

    this.logger.log(
      `Cleared stale entries for ${keyPath}:${refId}, langs=${staleLangs.join(',')}`,
    )
  }

  async deleteByKeyPath(
    keyPath: TranslationEntryKeyPath,
    lookupKey?: string,
  ): Promise<void> {
    const dictEntries = this.isDictKeyPath(keyPath)
      ? await this.entryRepository.listFiltered({ keyPath, lookupKey })
      : []

    if (lookupKey) {
      await this.entryRepository.deleteByKeyPath(keyPath, lookupKey)
    } else {
      await this.entryRepository.deleteMany({ keyPath })
    }
    await this.deleteCachedDictTranslations(dictEntries)
  }

  async findEntries(query: {
    keyPath?: TranslationEntryKeyPath
    lang?: string
    page?: number
    size?: number
  }) {
    const page = query.page || 1
    const size = query.size || 20

    const { data, pagination } = await this.entryRepository.listPaginated(
      {
        keyPath: query.keyPath,
        lang: query.lang,
      },
      page,
      size,
    )

    return { data, pagination: { total: pagination.total, page, size } }
  }

  async updateEntry(id: string, translatedText: string) {
    const updated = await this.entryRepository.updateTranslatedText(
      id,
      translatedText,
    )

    if (updated?.keyType === 'dict') {
      await this.cacheDictTranslations([
        {
          keyPath: updated.keyPath,
          lang: updated.lang,
          lookupKey: updated.lookupKey,
          translatedText: updated.translatedText,
        },
      ])
    }

    return updated
  }

  async deleteEntry(id: string) {
    const deleted = await this.entryRepository.deleteById(id)

    if (deleted?.keyType === 'dict') {
      await this.deleteCachedDictTranslations([
        {
          keyPath: deleted.keyPath,
          lang: deleted.lang,
          lookupKey: deleted.lookupKey,
        },
      ])
    }

    return deleted
  }

  private getDictCacheKey(keyPath: TranslationEntryKeyPath, lang: string) {
    return getRedisKey(RedisKeys.TranslationEntryDict, lang, keyPath)
  }

  private isDictKeyPath(keyPath: TranslationEntryKeyPath): boolean {
    return keyPath === 'note.mood' || keyPath === 'note.weather'
  }

  private async getCachedDictTranslations(
    keyPath: TranslationEntryKeyPath,
    lang: string,
    hashToText: Map<string, string>,
  ): Promise<{
    cachedMap: Map<string, string>
    missedLookupKeys: string[]
  }> {
    const lookupKeys = [...hashToText.keys()]
    if (!lookupKeys.length) {
      return { cachedMap: new Map(), missedLookupKeys: [] }
    }

    try {
      const client = this.redisService.getClient()
      const cacheKey = this.getDictCacheKey(keyPath, lang)
      const values = await client.hmget(cacheKey, ...lookupKeys)

      const cachedMap = new Map<string, string>()
      const missedLookupKeys: string[] = []

      lookupKeys.forEach((lookupKey, index) => {
        const translated = values[index]
        if (translated) {
          const sourceText = hashToText.get(lookupKey)
          if (sourceText) {
            cachedMap.set(sourceText, translated)
          }
        } else {
          missedLookupKeys.push(lookupKey)
        }
      })

      return { cachedMap, missedLookupKeys }
    } catch (error) {
      this.logger.warn(
        `Translation dict cache read failed: ${(error as Error).message}`,
      )
      return { cachedMap: new Map(), missedLookupKeys: lookupKeys }
    }
  }

  private async cacheDictTranslations(
    entries: DictCacheEntry[],
  ): Promise<void> {
    if (!entries.length) return

    try {
      const client = this.redisService.getClient()
      const pipeline = client.pipeline()
      const touchedKeys = new Set<string>()

      for (const entry of entries) {
        const cacheKey = this.getDictCacheKey(entry.keyPath, entry.lang)
        pipeline.hset(cacheKey, entry.lookupKey, entry.translatedText)
        touchedKeys.add(cacheKey)
      }

      for (const cacheKey of touchedKeys) {
        pipeline.expire(
          cacheKey,
          TranslationEntryService.DICT_CACHE_TTL_SECONDS,
        )
      }

      await pipeline.exec()
    } catch (error) {
      this.logger.warn(
        `Translation dict cache write failed: ${(error as Error).message}`,
      )
    }
  }

  private async deleteCachedDictTranslations(
    entries: Array<
      Pick<TranslationEntryModel, 'keyPath' | 'lang' | 'lookupKey'>
    >,
  ): Promise<void> {
    if (!entries.length) return

    try {
      const client = this.redisService.getClient()
      const pipeline = client.pipeline()

      for (const entry of entries) {
        if (!this.isDictKeyPath(entry.keyPath)) continue
        const cacheKey = this.getDictCacheKey(entry.keyPath, entry.lang)
        pipeline.hdel(cacheKey, entry.lookupKey)
      }

      await pipeline.exec()
    } catch (error) {
      this.logger.warn(
        `Translation dict cache delete failed: ${(error as Error).message}`,
      )
    }
  }
}
