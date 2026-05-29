import { deleteJson, getJson, patchJson, postJson, requestJson } from './http'

export enum AiQueryType {
  Slug = 'slug',
  TitleSlug = 'title-slug',
}

export interface AIWriterGenerateData {
  text?: string
  title?: string
  type: AiQueryType
}

export interface AIWriterGenerateResponse {
  slug?: string
  title?: string
}

export interface ArticleInfo {
  id: string
  title: string
  type: 'Note' | 'Page' | 'Post' | 'Recently'
}

export interface PaginationInfo {
  currentPage?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
  page?: number
  size: number
  total: number
  totalPage?: number
}

export interface AISummary {
  createdAt: string
  hash: string
  id: string
  lang: string
  refId: string
  summary: string
}

export interface GroupedSummaryData {
  article: ArticleInfo
  summaries: AISummary[]
}

export interface GroupedSummaryResponse {
  data: GroupedSummaryData[]
  pagination: PaginationInfo
}

export interface SummaryByRefResponse {
  article: {
    document: { title: string }
    type: 'Note' | 'Page' | 'Post' | 'Recently'
  }
  summaries: AISummary[]
}

export interface AIInsights {
  content: string
  createdAt: string
  hash: string
  id: string
  isTranslation: boolean
  lang: string
  refId: string
  sourceInsightsId?: string
  sourceLang?: string
}

export interface GroupedInsightsData {
  article: ArticleInfo
  insights: AIInsights[]
}

export interface GroupedInsightsResponse {
  data: GroupedInsightsData[]
  pagination: PaginationInfo
}

export interface InsightsByRefResponse {
  article: {
    document: { title: string }
    type: 'Note' | 'Page' | 'Post' | 'Recently'
  } | null
  insights: AIInsights[]
}

export type AIContentFormat = 'lexical' | 'markdown' | string

export interface AITranslation {
  aiModel?: string
  aiProvider?: string
  content?: string
  contentFormat?: AIContentFormat
  createdAt: string
  hash: string
  id: string
  lang: string
  refId: string
  refType: string
  sourceLang: string
  subtitle?: string
  summary?: string
  tags?: string[]
  text: string
  title: string
}

export interface GroupedTranslationData {
  article: ArticleInfo
  translations: AITranslation[]
}

export interface GroupedTranslationResponse {
  data: GroupedTranslationData[]
  pagination: PaginationInfo
}

export interface TranslationByRefResponse {
  article: {
    document: { title: string }
    type: 'Note' | 'Page' | 'Post' | 'Recently'
  }
  translations: AITranslation[]
}

export interface ProviderModel {
  id: string
  name: string
}

export interface ProviderModelsResponse {
  error?: string
  models: ProviderModel[]
  providerId: string
  providerName: string
  providerType: string
}

export interface AITestData {
  apiKey?: string
  endpoint?: string
  model?: string
  providerId: string
  type: string
}

export interface AIModelListData {
  apiKey?: string
  endpoint?: string
  providerId: string
  type: string
}

export interface AICommentReviewTestData {
  author?: string
  text: string
}

export interface AICommentReviewTestResponse {
  isSpam: boolean
  reason?: string
  score?: number
}

export type TranslationEntryKeyPath =
  | 'category.name'
  | 'note.mood'
  | 'note.weather'
  | 'topic.introduce'
  | 'topic.name'

export interface TranslationEntry {
  createdAt: string
  id: string
  keyPath: TranslationEntryKeyPath
  keyType: 'dict' | 'entity'
  lang: string
  lookupKey: string
  sourceText: string
  sourceUpdatedAt?: string
  translatedText: string
}

export interface TranslationEntriesResponse {
  data: TranslationEntry[]
  pagination: {
    page: number
    size: number
    total: number
  }
}

export interface GenerateEntriesResponse {
  created: number
  skipped: number
}

export enum AITaskType {
  Summary = 'ai:summary',
  Translation = 'ai:translation',
  TranslationBatch = 'ai:translation:batch',
  TranslationAll = 'ai:translation:all',
  SlugBackfill = 'ai:slug:backfill',
  Insights = 'ai:insights',
  InsightsTranslation = 'ai:insights:translation',
}

export enum AITaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  PartialFailed = 'partial_failed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface AITaskLog {
  level: 'error' | 'info' | 'warn'
  message: string
  timestamp: number
}

export interface SubTaskStats {
  completed: number
  failed: number
  pending: number
  running: number
  total: number
}

export interface AITask {
  completedAt?: number
  completedItems?: number
  createdAt: number
  error?: string
  groupId?: string
  id: string
  logs: AITaskLog[]
  payload: Record<string, unknown>
  progress?: number
  progressMessage?: string
  result?: unknown
  retryCount: number
  startedAt?: number
  status: AITaskStatus
  subTaskStats?: SubTaskStats
  tokensGenerated?: number
  totalItems?: number
  type: AITaskType
  workerId?: string
}

export interface AITasksResponse {
  data: AITask[]
  total: number
}

export interface CreateTaskResponse {
  created: boolean
  taskId: string
}

export function testCommentReview(data: AICommentReviewTestData) {
  return postJson<AICommentReviewTestResponse, AICommentReviewTestData>(
    '/ai/comment-review/test',
    data,
  )
}

export function writerGenerate(data: AIWriterGenerateData) {
  return postJson<AIWriterGenerateResponse, AIWriterGenerateData>(
    '/ai/writer/generate',
    data,
  )
}

export function getSummariesGrouped(params?: {
  page?: number
  search?: string
  size?: number
}) {
  return getJson<GroupedSummaryResponse>('/ai/summaries/grouped', params)
}

export function getSummaryByRef(refId: string) {
  return getJson<SummaryByRefResponse>(`/ai/summaries/ref/${refId}`)
}

export function deleteSummary(id: string) {
  return deleteJson<void>(`/ai/summaries/${id}`)
}

export function updateSummary(id: string, data: { summary: string }) {
  return patchJson<AISummary, { summary: string }>(`/ai/summaries/${id}`, data)
}

export function createSummaryTask(data: { lang?: string; refId: string }) {
  return postJson<CreateTaskResponse, { lang?: string; refId: string }>(
    '/ai/summaries/task',
    data,
  )
}

export function getInsightsGrouped(params: {
  page: number
  search?: string
  size?: number
}) {
  return getJson<GroupedInsightsResponse>('/ai/insights/grouped', params)
}

export function getInsightsByRef(refId: string) {
  return getJson<InsightsByRefResponse>(`/ai/insights/ref/${refId}`)
}

export function deleteInsights(id: string) {
  return deleteJson<void>(`/ai/insights/${id}`)
}

export function updateInsights(id: string, data: { content: string }) {
  return patchJson<AIInsights, { content: string }>(`/ai/insights/${id}`, data)
}

export function createInsightsTask(data: { refId: string }) {
  return postJson<CreateTaskResponse, { refId: string }>(
    '/ai/insights/task',
    data,
  )
}

export function createInsightsTranslationTask(data: {
  refId: string
  targetLang: string
}) {
  return postJson<CreateTaskResponse, { refId: string; targetLang: string }>(
    '/ai/insights/task/translate',
    data,
  )
}

export function getModels() {
  return getJson<ProviderModelsResponse[]>('/ai/models')
}

export function getModelList(data: AIModelListData) {
  return postJson<{ error?: string; models: ProviderModel[] }, AIModelListData>(
    '/ai/models/list',
    data,
  )
}

export function testConfig(data: AITestData) {
  return postJson<void, AITestData>('/ai/test', data)
}

export function getTranslationsGrouped(params?: {
  page?: number
  search?: string
  size?: number
}) {
  return getJson<GroupedTranslationResponse>('/ai/translations/grouped', params)
}

export function getTranslationsByRef(refId: string) {
  return getJson<TranslationByRefResponse>(`/ai/translations/ref/${refId}`)
}

export function deleteTranslation(id: string) {
  return deleteJson<void>(`/ai/translations/${id}`)
}

export function updateTranslation(
  id: string,
  data: {
    content?: string
    subtitle?: string
    summary?: string
    tags?: string[]
    text?: string
    title?: string
  },
) {
  return patchJson<AITranslation, typeof data>(`/ai/translations/${id}`, data)
}

export function createTranslationTask(data: {
  refId: string
  targetLanguages?: string[]
}) {
  return postJson<
    CreateTaskResponse,
    { refId: string; targetLanguages?: string[] }
  >('/ai/translations/task', data)
}

export function createTranslationBatchTask(data: {
  refIds: string[]
  targetLanguages?: string[]
}) {
  return postJson<
    CreateTaskResponse,
    { refIds: string[]; targetLanguages?: string[] }
  >('/ai/translations/task/batch', data)
}

export function createTranslationAllTask(data: { targetLanguages?: string[] }) {
  return postJson<CreateTaskResponse, { targetLanguages?: string[] }>(
    '/ai/translations/task/all',
    data,
  )
}

export interface GetAiTasksParams {
  page?: number
  size?: number
  status?: AITaskStatus
  type?: AITaskType
}

export function getAiTasks(params: GetAiTasksParams = {}) {
  return getJson<AITasksResponse | AITask[]>('/ai/tasks', {
    page: params.page,
    size: params.size,
    status: params.status,
    type: params.type,
  }).then(normalizeTasksResponse)
}

export function getAiTask(taskId: string) {
  return getJson<AITask>(`/ai/tasks/${taskId}`)
}

export function retryAiTask(taskId: string) {
  return requestJson<CreateTaskResponse>(`/ai/tasks/${taskId}/retry`, {
    method: 'POST',
  })
}

export function cancelAiTask(taskId: string) {
  return requestJson<{ success: boolean }>(`/ai/tasks/${taskId}/cancel`, {
    method: 'POST',
  })
}

export function deleteAiTask(taskId: string) {
  return deleteJson<{ success: boolean }>(`/ai/tasks/${taskId}`)
}

export function deleteAiTasks(params: {
  before: number
  status?: AITaskStatus
  type?: AITaskType
}) {
  const searchParams = new URLSearchParams()
  searchParams.set('before', String(params.before))
  if (params.status) searchParams.set('status', params.status)
  if (params.type) searchParams.set('type', params.type)

  return requestJson<{ deleted: number }>(`/ai/tasks?${searchParams}`, {
    method: 'DELETE',
  })
}

export function getAiTasksByGroupId(groupId: string) {
  return getJson<AITask[]>(`/ai/tasks/group/${groupId}`)
}

export function cancelAiTasksByGroupId(groupId: string) {
  return deleteJson<{ cancelled: number }>(`/ai/tasks/group/${groupId}`)
}

export function getTranslationEntries(params?: {
  keyPath?: TranslationEntryKeyPath
  lang?: string
  page?: number
  size?: number
}) {
  return getJson<TranslationEntriesResponse>('/ai/translations/entries', params)
}

export function generateTranslationEntries(data?: {
  keyPaths?: TranslationEntryKeyPath[]
  targetLanguages?: string[]
}) {
  return postJson<
    GenerateEntriesResponse,
    { keyPaths?: TranslationEntryKeyPath[]; targetLanguages?: string[] } | null
  >('/ai/translations/entries/generate', data ?? null)
}

export function updateTranslationEntry(
  id: string,
  data: { translatedText: string },
) {
  return patchJson<TranslationEntry, { translatedText: string }>(
    `/ai/translations/entries/${id}`,
    data,
  )
}

export function deleteTranslationEntry(id: string) {
  return deleteJson<void>(`/ai/translations/entries/${id}`)
}

function normalizeTasksResponse(
  response: AITasksResponse | AITask[],
): AITasksResponse {
  if (Array.isArray(response)) {
    return {
      data: response,
      total: response.length,
    }
  }

  return response
}
