import { deleteJson, getJson, patchJson, postJson } from './http'
import type { CreateTaskResponse } from './tasks'

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

export interface RegistryModelCosts {
  cachedInputPerMillion: number
  inputPerMillion: number
  outputPerMillion: number
}

export interface RegistryModel {
  contextWindow: number
  costs: RegistryModelCosts
  id: string
  maxTokens: number
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

export type { CreateTaskResponse }

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

export function getRegistryModels(providerId: string) {
  return getJson<RegistryModel[]>('/ai/registry/models', { providerId })
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
