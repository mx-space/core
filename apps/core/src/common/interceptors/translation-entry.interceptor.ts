import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Observable } from 'rxjs'
import { from, switchMap } from 'rxjs'

import { RequestContext } from '~/common/contexts/request.context'
import {
  TRANSLATE_FIELDS_KEY,
  type TranslateFieldRule,
} from '~/common/decorators/translate-fields.decorator'
import type { TranslationEntryKeyPath } from '~/modules/ai/ai-translation/translation-entry.model'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { resolveRequestedLanguage } from '~/utils/lang.util'

interface EntityLookup {
  keyPath: TranslationEntryKeyPath
  ids: Set<string>
}

interface DictLookup {
  keyPath: TranslationEntryKeyPath
  texts: Set<string>
}

@Injectable()
export class TranslationEntryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TranslationEntryInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rules = this.reflector.get<TranslateFieldRule[] | undefined>(
      TRANSLATE_FIELDS_KEY,
      context.getHandler(),
    )
    if (!rules?.length) return next.handle()

    const request = getNestExecutionContextRequest(context)
    const query = request.query as Record<string, unknown>
    const lang = resolveRequestedLanguage(
      query?.lang,
      RequestContext.currentLang(),
    )

    if (!lang) return next.handle()

    return next
      .handle()
      .pipe(
        switchMap((data) => from(this.applyTranslations(data, rules, lang!))),
      )
  }

  private async applyTranslations(
    data: any,
    rules: TranslateFieldRule[],
    lang: string,
  ): Promise<any> {
    if (data == null) return data

    const entityLookups = new Map<TranslationEntryKeyPath, EntityLookup>()
    const dictLookups = new Map<TranslationEntryKeyPath, DictLookup>()

    for (const rule of rules) {
      if (rule.idField) {
        if (!entityLookups.has(rule.keyPath)) {
          entityLookups.set(rule.keyPath, {
            keyPath: rule.keyPath,
            ids: new Set(),
          })
        }
        const lookup = entityLookups.get(rule.keyPath)!
        this.collectEntityIds(data, rule.path, rule.idField, lookup.ids)
      } else {
        if (!dictLookups.has(rule.keyPath)) {
          dictLookups.set(rule.keyPath, {
            keyPath: rule.keyPath,
            texts: new Set(),
          })
        }
        const lookup = dictLookups.get(rule.keyPath)!
        this.collectDictTexts(data, rule.path, lookup.texts)
      }
    }

    let entityMaps: Map<TranslationEntryKeyPath, Map<string, string>>
    let dictMaps: Map<TranslationEntryKeyPath, Map<string, string>>

    try {
      const batchResult =
        await this.translationEntryService.getTranslationsBatch(lang, {
          entityLookups: [...entityLookups.values()]
            .filter((lookup) => lookup.ids.size)
            .map((lookup) => ({
              keyPath: lookup.keyPath,
              lookupKeys: [...lookup.ids],
            })),
          dictLookups: [...dictLookups.values()]
            .filter((lookup) => lookup.texts.size)
            .map((lookup) => ({
              keyPath: lookup.keyPath,
              sourceTexts: [...lookup.texts],
            })),
        })
      entityMaps = batchResult.entityMaps
      dictMaps = batchResult.dictMaps
    } catch (error) {
      this.logger.error(
        `Translation entry lookup failed: ${(error as Error).message}`,
      )
      return data
    }

    const hasTranslations = [...entityMaps.values(), ...dictMaps.values()].some(
      (map) => map.size > 0,
    )
    if (!hasTranslations) return data

    const result = this.deepClone(data)

    for (const rule of rules) {
      if (rule.idField) {
        const map = entityMaps.get(rule.keyPath)
        if (map?.size) {
          this.replaceEntityValues(result, rule.path, rule.idField, map)
        }
      } else {
        const map = dictMaps.get(rule.keyPath)
        if (map?.size) {
          this.replaceDictValues(result, rule.path, map)
        }
      }
    }

    return result
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (Array.isArray(obj)) return obj.map((item) => this.deepClone(item))
    if (typeof obj.toHexString === 'function') return obj
    const clone: any = {}
    for (const key of Object.keys(obj)) {
      clone[key] = this.deepClone(obj[key])
    }
    return clone
  }

  private resolvePath(obj: any, segments: string[]): any[] {
    if (!segments.length) return [obj]
    const [head, ...rest] = segments
    if (head === '[]') {
      if (!Array.isArray(obj)) return []
      return obj.flatMap((item) => this.resolvePath(item, rest))
    }
    if (obj == null || typeof obj !== 'object') return []
    return this.resolvePath(obj[head], rest)
  }

  private parsePathSegments(path: string): {
    parentSegments: string[]
    field: string
  } {
    const parts = path.split('.')
    const segments: string[] = []
    for (const part of parts) {
      if (part.endsWith('[]')) {
        segments.push(part.slice(0, -2))
        segments.push('[]')
      } else {
        segments.push(part)
      }
    }
    const field = segments.pop()!
    return { parentSegments: segments, field }
  }

  private collectEntityIds(
    data: any,
    path: string,
    idField: string,
    ids: Set<string>,
  ): void {
    const { parentSegments, field: _ } = this.parsePathSegments(path)
    const parents = this.resolvePath(data, parentSegments)
    for (const parent of parents) {
      if (parent == null || typeof parent !== 'object') continue
      const id = parent[idField]
      if (id != null) {
        ids.add(
          typeof id === 'object' && id.toString ? id.toString() : String(id),
        )
      }
    }
  }

  private collectDictTexts(data: any, path: string, texts: Set<string>): void {
    const { parentSegments, field } = this.parsePathSegments(path)
    const parents = this.resolvePath(data, parentSegments)
    for (const parent of parents) {
      if (parent == null || typeof parent !== 'object') continue
      const val = parent[field]
      if (typeof val === 'string' && val) {
        texts.add(val)
      }
    }
  }

  private replaceEntityValues(
    data: any,
    path: string,
    idField: string,
    map: Map<string, string>,
  ): void {
    const { parentSegments, field } = this.parsePathSegments(path)
    const parents = this.resolvePath(data, parentSegments)
    for (const parent of parents) {
      if (parent == null || typeof parent !== 'object') continue
      const id = parent[idField]
      if (id == null) continue
      const idStr =
        typeof id === 'object' && id.toString ? id.toString() : String(id)
      const translated = map.get(idStr)
      if (translated) {
        parent[field] = translated
      }
    }
  }

  private replaceDictValues(
    data: any,
    path: string,
    map: Map<string, string>,
  ): void {
    const { parentSegments, field } = this.parsePathSegments(path)
    const parents = this.resolvePath(data, parentSegments)
    for (const parent of parents) {
      if (parent == null || typeof parent !== 'object') continue
      const val = parent[field]
      if (typeof val === 'string' && val) {
        const translated = map.get(val)
        if (translated) {
          parent[field] = translated
        }
      }
    }
  }
}
