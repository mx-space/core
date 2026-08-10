import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import { paginationOf } from '~/processors/database/base.repository'
import {
  buildRefArticleMap,
  DatabaseService,
  type RefArticleInfo,
} from '~/processors/database/database.service'
import { TaskQueueService, TaskStatus } from '~/processors/task-queue'

import { ConfigsService } from '../../configs/configs.service'
import { AiGenerationMetricsService } from '../ai-generation-metrics/ai-generation-metrics.service'
import { normalizeTargetLangs, parseLanguageCode } from '../ai-language.util'
import { readArticleMetaLang } from '../ai-translation/article-content.util'
import { AiOverviewRepository } from './ai-overview.repository'
import type { GetOverviewGroupedQueryInput } from './ai-overview.schema'
import type {
  AiOverviewCost,
  AiOverviewDetail,
  AiOverviewListRow,
  ArticleCoverage,
  CostBucket,
} from './ai-overview.types'
import { AI_OVERVIEW_CAPABILITIES, emptyCostBucket } from './ai-overview.types'
import { toActiveGenerations } from './ai-overview-active-tasks.util'
import { buildArticleCoverage, countGaps } from './ai-overview-coverage.util'

const ACTIVE_TASK_SCAN_SIZE = 100
const FAILURE_RETENTION_MS = 10 * 60 * 1000

type MetaBearing = { meta?: Record<string, unknown> | null }

@Injectable()
export class AiOverviewService {
  constructor(
    private readonly repository: AiOverviewRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly generationMetrics: AiGenerationMetricsService,
    private readonly taskQueueService: TaskQueueService,
  ) {}

  async getOverviewGrouped(query: GetOverviewGroupedQueryInput) {
    const { page, size } = query
    const search = query.search?.trim()

    const searchableRefIds = search
      ? await this.databaseService.findArticleIdsByTitle(search)
      : undefined

    if (search && !searchableRefIds?.length) {
      return {
        data: [] as AiOverviewListRow[],
        pagination: paginationOf(0, page, size),
      }
    }

    const candidates =
      await this.databaseService.findAllArticlesForTranslation()
    const candidateMap = buildRefArticleMap(candidates)

    const searchSet = searchableRefIds ? new Set(searchableRefIds) : null
    // Snowflake ids are monotonic, so descending id is descending creation
    // time without joining the article tables again for a timestamp.
    const orderedIds = Object.keys(candidateMap)
      .filter((id) => !searchSet || searchSet.has(id))
      .filter((id) => !query.type || candidateMap[id].type === query.type)
      .sort((a, b) => b.localeCompare(a))

    const total = orderedIds.length
    const pageIds = orderedIds.slice(
      (page - 1) * size,
      (page - 1) * size + size,
    )

    if (!pageIds.length) {
      return {
        data: [] as AiOverviewListRow[],
        pagination: paginationOf(total, page, size),
      }
    }

    const [coverageRows, documents, configured] = await Promise.all([
      this.repository.coverageByRefIds(pageIds),
      this.databaseService.findGlobalByIds(pageIds),
      this.resolveConfiguredLanguages(),
    ])

    const metaLangById = this.buildMetaLangMap(documents)

    const data = pageIds.map<AiOverviewListRow>((refId) => {
      const article = candidateMap[refId]
      const coverage = buildArticleCoverage({
        type: article.type,
        metaLang: metaLangById.get(refId) ?? null,
        summaryLangs: pluckLangs(coverageRows.summary, refId),
        insightsLangs: pluckLangs(coverageRows.insights, refId),
        translationLangs: pluckLangs(coverageRows.translation, refId),
        translationSourceLangs: coverageRows.translation
          .filter((row) => row.refId === refId)
          .map((row) => row.sourceLang),
        ttsLangs: pluckLangs(coverageRows.tts, refId),
        configured,
      })
      return { article, coverage, gapCount: countGaps(coverage) }
    })

    return { data, pagination: paginationOf(total, page, size) }
  }

  async getArticleOverview(refId: string): Promise<AiOverviewDetail> {
    const found = await this.databaseService.findGlobalById(refId)
    if (!found || found.type === CollectionRefTypes.Recently) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND)
    }

    const article: RefArticleInfo = {
      id: refId,
      title: (found.document as { title: string }).title,
      type: found.type,
    }

    const [summary, insights, translation, tts, configured, cost, activeTasks] =
      await Promise.all([
        this.repository
          .summaryAssets(refId)
          .then((rows) => this.generationMetrics.attachLatest('summary', rows)),
        this.repository
          .insightsAssets(refId)
          .then((rows) =>
            this.generationMetrics.attachLatest('insights', rows),
          ),
        this.repository
          .translationAssets(refId)
          .then((rows) =>
            this.generationMetrics.attachLatest('translation', rows),
          ),
        this.repository
          .ttsAssets(refId)
          .then((rows) => this.generationMetrics.attachLatest('tts', rows)),
        this.resolveConfiguredLanguages(),
        this.buildCost(refId),
        this.findActiveTasks(refId),
      ])

    const coverage: ArticleCoverage = buildArticleCoverage({
      type: found.type,
      metaLang: normaliseMetaLang(found.document as MetaBearing),
      summaryLangs: summary.map((row) => row.lang),
      insightsLangs: insights.map((row) => row.lang),
      translationLangs: translation.map((row) => row.lang),
      translationSourceLangs: translation.map((row) => row.sourceLang),
      ttsLangs: tts.map((row) => row.lang),
      configured,
    })

    return {
      article,
      coverage,
      activeTasks,
      assets: { summary, insights, translation, tts },
      cost,
    }
  }

  /**
   * In-flight tasks plus recent failures. A generation that dies on its first
   * tick — a disabled AI feature, a bad key — otherwise vanishes between two
   * polls and the board silently reverts to "not generated", leaving no trace
   * of why. Failures age out so the board does not accuse forever.
   */
  private async findActiveTasks(refId: string) {
    const { data } = await this.taskQueueService.getTasks({
      scope: 'ai',
      status: [
        TaskStatus.Pending,
        TaskStatus.Running,
        TaskStatus.Failed,
        TaskStatus.PartialFailed,
      ],
      page: 1,
      size: ACTIVE_TASK_SCAN_SIZE,
      // Batch and all-article translations finish by enqueueing child
      // `ai:translation` tasks under a groupId; those children are the ones
      // actually generating, so excluding them shows the article as idle while
      // it is mid-generation. `refId` keeps the page cap from being spent on
      // unrelated tasks — a queue full of another article's failures would
      // otherwise push this one's live task off the first page.
      includeSubTasks: true,
      refId,
    })

    const cutoff = Date.now() - FAILURE_RETENTION_MS
    const relevant = data.filter((task) => {
      if (
        task.status !== TaskStatus.Failed &&
        task.status !== TaskStatus.PartialFailed
      ) {
        return true
      }
      return (task.completedAt ?? task.createdAt) >= cutoff
    })

    return toActiveGenerations(relevant, refId)
  }

  private async buildCost(refId: string): Promise<AiOverviewCost> {
    const [sums, models] = await Promise.all([
      this.generationMetrics.sumByRef(refId),
      this.generationMetrics.findModelsByRef(refId),
    ])

    const byResourceType = Object.fromEntries(
      AI_OVERVIEW_CAPABILITIES.map((key) => [key, emptyCostBucket()]),
    ) as AiOverviewCost['byResourceType']
    const total = emptyCostBucket()

    for (const row of sums) {
      const bucket = byResourceType[row.resourceType]
      if (!bucket) continue
      const values: CostBucket = {
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadTokens: row.cacheReadTokens,
        cacheWriteTokens: row.cacheWriteTokens,
        totalTokens: row.totalTokens,
        costTotalUsd: row.costTotalUsd,
        generationCount: row.generationCount,
      }
      byResourceType[row.resourceType] = values
      for (const key of Object.keys(total) as Array<keyof CostBucket>) {
        total[key] += values[key]
      }
    }

    return { total, byResourceType, models }
  }

  // The handlers canonicalize their targets before generating, so a setting of
  // `zh-CN` lands as a `zh` row. Comparing the raw setting against it would
  // report a gap no amount of generating can close.
  private async resolveConfiguredLanguages() {
    const aiConfig = await this.configService.get('ai')
    return {
      summary: normalizeTargetLangs(aiConfig.summaryTargetLanguages),
      insights: normalizeTargetLangs(aiConfig.insightsTargetLanguages),
      translation: normalizeTargetLangs(aiConfig.translationTargetLanguages),
    }
  }

  private buildMetaLangMap(documents: {
    posts: MetaBearing[]
    notes: MetaBearing[]
    pages: MetaBearing[]
  }): Map<string, string> {
    const map = new Map<string, string>()
    for (const document of [
      ...documents.posts,
      ...documents.notes,
      ...documents.pages,
    ]) {
      const lang = normaliseMetaLang(document)
      if (lang) map.set(String((document as { id: string }).id), lang)
    }
    return map
  }
}

function pluckLangs(
  rows: Array<{ refId: string; lang: string }>,
  refId: string,
) {
  return rows.filter((row) => row.refId === refId).map((row) => row.lang)
}

// `parseLanguageCode` falls back to the default language for any unusable
// input, so it must only see a real declared value — otherwise every article
// without `meta.lang` would claim Chinese as its source.
function normaliseMetaLang(document: MetaBearing): string | null {
  const raw = readArticleMetaLang(document)
  return raw ? parseLanguageCode(raw) : null
}
