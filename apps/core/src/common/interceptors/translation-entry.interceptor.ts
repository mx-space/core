import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { isPlainObject } from 'es-toolkit/compat'
import objectScan from 'object-scan'
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

interface ScanMatch {
  parent: Record<string | number, any> | any[] | undefined
  property: string | number | undefined
  value: any
}

interface ScanContext {
  visitor: (match: ScanMatch) => void
}

type ObjectScanner = (haystack: any, context: ScanContext) => ScanContext
type LookupMaps = {
  entityLookups: Map<TranslationEntryKeyPath, EntityLookup>
  dictLookups: Map<TranslationEntryKeyPath, DictLookup>
}

@Injectable()
export class TranslationEntryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TranslationEntryInterceptor.name)
  private scannerCache?: Map<string, ObjectScanner>

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

    // Always convert to plain objects first to ensure objectScan can
    // traverse Mongoose documents (e.g. populated refs like category).
    // Without this, a mix of .lean() and non-.lean() data causes partial
    // scan success, skipping the fallback for the non-plain parts.
    const plainData = this.toScannableObject(data)
    const translationTarget = plainData ?? data
    const { entityLookups, dictLookups } = this.buildLookups(
      translationTarget,
      rules,
    )

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

    for (const rule of rules) {
      if (rule.idField) {
        const map = entityMaps.get(rule.keyPath)
        if (map?.size) {
          this.replaceEntityValues(
            translationTarget,
            rule.path,
            rule.idField,
            map,
          )
        }
      } else {
        const map = dictMaps.get(rule.keyPath)
        if (map?.size) {
          this.replaceDictValues(translationTarget, rule.path, map)
        }
      }
    }

    return translationTarget
  }

  private buildLookups(data: any, rules: TranslateFieldRule[]): LookupMaps {
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

    return { entityLookups, dictLookups }
  }

  private toScannableObject(data: any): any | null {
    if (data == null || typeof data !== 'object') {
      return null
    }

    return this.normalizeScannableValue(data)
  }

  private normalizeScannableValue(value: any): any {
    if (value == null || typeof value !== 'object') {
      return value
    }

    if (Array.isArray(value)) {
      let changed = false
      const normalized = value.map((item) => {
        const next = this.normalizeScannableValue(item)
        if (next !== item) {
          changed = true
        }
        return next
      })

      return changed ? normalized : value
    }

    if (!isPlainObject(value)) {
      if (typeof value.toJSON === 'function') {
        return this.normalizeScannableValue(value.toJSON())
      }

      if (typeof value.toObject === 'function') {
        return this.normalizeScannableValue(value.toObject())
      }

      try {
        return JSON.parse(JSON.stringify(value))
      } catch {
        return value
      }
    }

    let changed = false
    const normalized: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value)) {
      const next = this.normalizeScannableValue(child)
      if (next !== child) {
        changed = true
      }
      normalized[key] = next
    }

    return changed ? normalized : value
  }

  private toObjectScanPath(path: string): string {
    return path.replaceAll('[]', '[*]')
  }

  private getScanner(path: string): ObjectScanner {
    const normalizedPath = this.toObjectScanPath(path)
    this.scannerCache ??= new Map<string, ObjectScanner>()

    const cached = this.scannerCache.get(normalizedPath)
    if (cached) {
      return cached
    }

    const scanner = objectScan<ScanContext>([normalizedPath], {
      rtn: 'context',
      filterFn: ({ parent, property, value, context }) => {
        context.visitor({ parent, property, value })
      },
    }) as ObjectScanner

    this.scannerCache.set(normalizedPath, scanner)
    return scanner
  }

  private visitMatches(
    data: any,
    path: string,
    visitor: (match: ScanMatch) => void,
  ): void {
    this.getScanner(path)(data, { visitor })
  }

  private collectEntityIds(
    data: any,
    path: string,
    idField: 'id',
    ids: Set<string>,
  ): void {
    this.visitMatches(data, path, ({ parent }) => {
      if (parent == null || typeof parent !== 'object') return
      const id = parent[idField]
      if (id != null) {
        ids.add(
          typeof id === 'object' && id.toString ? id.toString() : String(id),
        )
      }
    })
  }

  private collectDictTexts(data: any, path: string, texts: Set<string>): void {
    this.visitMatches(data, path, ({ value }) => {
      if (typeof value === 'string' && value) {
        texts.add(value)
      }
    })
  }

  private replaceEntityValues(
    data: any,
    path: string,
    idField: 'id',
    map: Map<string, string>,
  ): void {
    this.visitMatches(data, path, ({ parent, property }) => {
      if (
        parent == null ||
        typeof parent !== 'object' ||
        property == null ||
        !(property in parent)
      ) {
        return
      }

      const id = parent[idField]
      if (id == null) return
      const idStr =
        typeof id === 'object' && id.toString ? id.toString() : String(id)
      const translated = map.get(idStr)
      if (translated) {
        parent[property] = translated
      }
    })
  }

  private replaceDictValues(
    data: any,
    path: string,
    map: Map<string, string>,
  ): void {
    this.visitMatches(data, path, ({ parent, property, value }) => {
      if (
        parent == null ||
        typeof parent !== 'object' ||
        property == null ||
        !(property in parent) ||
        typeof value !== 'string' ||
        !value
      ) {
        return
      }

      const translated = map.get(value)
      if (translated) {
        parent[property] = translated
      }
    })
  }
}
