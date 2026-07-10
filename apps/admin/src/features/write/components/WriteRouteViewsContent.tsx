import { projectAgentDiffNodesToFactualState } from '@haklex/rich-ext-ai-agent/static'
import { createMxLitexmlRegistry, mxLexicalToMarkdown } from '@mx-space/editor'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { load } from 'js-yaml'
import type { SerializedEditorState } from 'lexical'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  Braces,
  Bug,
  Check,
  Clock,
  Copy,
  File as FileIcon,
  FileText,
  Hash,
  History,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  useBeforeUnload,
  useBlocker,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { toast } from 'sonner'

import { AiQueryType, writerGenerate } from '~/api/ai'
import { getCategories, getTags } from '~/api/categories'
import type { CreateDraftData } from '~/api/drafts'
import {
  createDraft,
  getDraftById,
  getDraftByRef,
  getNewDrafts,
  updateDraft,
} from '~/api/drafts'
import { uploadFile, uploadFileWithProgress } from '~/api/files'
import type { CreateNoteData } from '~/api/notes'
import { getNoteById } from '~/api/notes'
import type { CreatePageData } from '~/api/pages'
import { getPageById } from '~/api/pages'
import type { CreatePostData } from '~/api/posts'
import { getPostById, getPosts } from '~/api/posts'
import { callBuiltInFunction } from '~/api/system'
import { getTopics } from '~/api/topics'
import { API_URL, WEB_URL } from '~/constants/env'
import {
  APP_SHELL_HEADER_HEIGHT_CLASS,
  APP_SHELL_HEADER_HEIGHT_VALUE,
} from '~/constants/layout'
import {
  useCollectionDetailQuery,
  useCollectionListQuery,
  useEntity,
  useEntityList,
} from '~/data/resource/hooks'
import type { CategoryEntity } from '~/data/resources/category'
import { categories as categoriesCollection } from '~/data/resources/category'
import { notes as notesCollection } from '~/data/resources/note'
import { saveNote } from '~/data/resources/note.mutations'
import { pages as pagesCollection } from '~/data/resources/page'
import { savePage } from '~/data/resources/page.mutations'
import { posts as postsCollection } from '~/data/resources/post'
import { savePost } from '~/data/resources/post.mutations'
import { topics as topicsCollection } from '~/data/resources/topic'
import { DraftStatusTag } from '~/features/drafts/components/draft-status-tag'
import { AgentPanel, useWriteAgent } from '~/features/write/components/agent'
import { DraftHintBanner } from '~/features/write/components/DraftHintBanner'
import { DraftPreviewBanner } from '~/features/write/components/DraftPreviewBanner'
import { SkillPicker } from '~/features/write/components/SkillPicker'
import { MetaPresetSection } from '~/features/write/meta-presets'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { translate } from '~/i18n/translate'
import type { TranslationKey } from '~/i18n/types'
import { prepareImageFileForUpload } from '~/lib/image-upload-privacy'
import type { Amap, AMapSearch } from '~/models/amap'
import type { Image as ImageModel } from '~/models/base'
import type { DraftModel } from '~/models/draft'
import { DraftRefType } from '~/models/draft'
import type { NoteModel } from '~/models/note'
import type { PageModel } from '~/models/page'
import type { PostModel } from '~/models/post'
import type { TopicModel } from '~/models/topic'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { Drawer } from '~/ui/feedback/drawer'
import { Modal, ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import {
  AsidePanel,
  ContentLayout,
  ContentLayoutSlot,
} from '~/ui/layout/content-layout'
import { HeaderBackButton } from '~/ui/layout/header-back-button'
import { Popover } from '~/ui/overlay/popover'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { DateTimePicker } from '~/ui/primitives/datetime-picker'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextArea, TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'
import { getDayOfYear } from '~/utils/time'
import { CodeMirrorEditor, ImageDropZone } from '~/vendor/codemirror'
import type {
  RichEditorWithAgentProps,
  RichEditorWithAgentRef,
} from '~/vendor/rich-editor/components/RichEditorWithAgent'
import { buildMxEditorLitexmlSystemMessages } from '~/vendor/rich-editor/utils/agent-litexml-prompt'
import { useDynamicCatalogSystemMessages } from '~/vendor/rich-editor/utils/dynamic-catalog'
import type { MetaFieldsSchema } from '~/vendor/rich-editor/utils/meta-tools'
import {
  buildMetaSystemMessages,
  buildMetaTools,
} from '~/vendor/rich-editor/utils/meta-tools'

type WriteKind = 'note' | 'page' | 'post'
type ContentFormat = 'lexical' | 'markdown'
type NoteCoordinates = { latitude: number; longitude: number }

interface WriteFormState {
  bookmark: boolean
  categoryId: string
  content: string
  contentFormat: ContentFormat
  coordinatesLat: string
  coordinatesLng: string
  copyright: boolean
  isPublished: boolean
  images: NonNullable<DraftModel['images']>
  location: string
  meta: Record<string, unknown>
  mood: string
  order: string
  password: string
  passwordProtected: boolean
  pin: boolean
  pinOrder: string
  publicAt: string
  relatedId: string
  slug: string
  subtitle: string
  summary: string
  tags: string
  text: string
  title: string
  topicId: string
  weather: string
}

const emptyState: WriteFormState = {
  bookmark: false,
  categoryId: '',
  content: '',
  contentFormat: 'markdown',
  coordinatesLat: '',
  coordinatesLng: '',
  copyright: true,
  isPublished: true,
  images: [],
  location: '',
  meta: {},
  mood: '',
  order: '',
  password: '',
  passwordProtected: false,
  pin: false,
  pinOrder: '1',
  publicAt: '',
  relatedId: '',
  slug: '',
  subtitle: '',
  summary: '',
  tags: '',
  text: '',
  title: '',
  topicId: '',
  weather: '',
}

const PREFERRED_CONTENT_FORMAT_STORAGE_KEY = 'preferred-content-format'
const RichEditorWithAgent = lazy(() =>
  import('~/vendor/rich-editor/components/RichEditorWithAgent').then(
    (module) => ({
      default: module.RichEditorWithAgent,
    }),
  ),
)

interface PresetOption {
  labelKey: TranslationKey
  value: string
}

// Mood/weather values are persisted as Chinese strings in the backend; we keep
// them as escape sequences so this source file stays free of inline CJK while
// still mapping to the existing API contract. Display labels come from i18n.
const MOOD_SET: readonly PresetOption[] = [
  { labelKey: 'write.mood.delight', value: '\u5F00\u5FC3' },
  { labelKey: 'write.mood.sad', value: '\u4F24\u5FC3' },
  { labelKey: 'write.mood.determined', value: '\u51B3\u5FC3' },
  { labelKey: 'write.mood.firm', value: '\u575A\u5B9A' },
  { labelKey: 'write.mood.hatred', value: '\u75DB\u6068' },
  { labelKey: 'write.mood.irritated', value: '\u751F\u6C14' },
  { labelKey: 'write.mood.grief', value: '\u60B2\u54C0' },
  { labelKey: 'write.mood.bitter', value: '\u75DB\u82E6' },
  { labelKey: 'write.mood.scared', value: '\u53EF\u6015' },
  { labelKey: 'write.mood.unease', value: '\u4E0D\u5FEB' },
  { labelKey: 'write.mood.loathed', value: '\u53EF\u6076' },
  { labelKey: 'write.mood.dread', value: '\u62C5\u5FC3' },
  { labelKey: 'write.mood.depressed', value: '\u7EDD\u671B' },
  { labelKey: 'write.mood.tense', value: '\u7126\u8651' },
  { labelKey: 'write.mood.excited', value: '\u6FC0\u52A8' },
] as const
const WEATHER_SET: readonly PresetOption[] = [
  { labelKey: 'write.weather.sunny', value: '\u6674' },
  { labelKey: 'write.weather.cloudy', value: '\u591A\u4E91' },
  { labelKey: 'write.weather.rain', value: '\u96E8' },
  { labelKey: 'write.weather.overcast', value: '\u9634' },
  { labelKey: 'write.weather.snow', value: '\u96EA' },
  { labelKey: 'write.weather.thunderstorm', value: '\u96F7\u96E8' },
] as const

const POST_META_SCHEMA: MetaFieldsSchema = {
  title: { description: 'Post title', type: 'string' },
  slug: {
    description:
      'URL path segment; prefer lowercase English words joined with hyphens.',
    example: 'my-first-post',
    type: 'string',
  },
  tags: { description: 'Post tag list', type: 'string[]' },
  summary: {
    description: 'Post summary; leave empty to auto-generate.',
    type: 'string',
  },
  copyright: {
    description: 'Whether to show the copyright notice at the end.',
    type: 'boolean',
  },
  pin: { description: 'Whether the post is pinned', type: 'boolean' },
  pinOrder: {
    description:
      'Pin order; higher numbers float to the top; set to 0 when pin is off.',
    type: 'number',
  },
  isPublished: {
    description: 'Published flag (false means draft).',
    type: 'boolean',
  },
}

const NOTE_META_SCHEMA: MetaFieldsSchema = {
  title: { description: 'Note title', type: 'string' },
  slug: {
    description: 'URL path segment; may be empty (then the nid path is used).',
    type: 'string',
  },
  mood: { description: 'Mood', type: 'string' },
  weather: { description: 'Weather', type: 'string' },
  bookmark: {
    description: 'Whether to mark as a bookmarked memory.',
    type: 'boolean',
  },
  location: { description: 'Location text (optional).', type: 'string' },
  isPublished: {
    description: 'Published flag (false means draft).',
    type: 'boolean',
  },
}

const PAGE_META_SCHEMA: MetaFieldsSchema = {
  title: { description: 'Page title', type: 'string' },
  slug: {
    description:
      'URL path segment; prefer lowercase English words joined with hyphens.',
    example: 'about',
    type: 'string',
  },
  subtitle: { description: 'Subtitle', type: 'string' },
  order: {
    description: 'Navigation order; smaller numbers come first.',
    type: 'number',
  },
}

interface KindConfig {
  description: string
  icon: LucideIcon
  listPath: string
  title: string
}

function getKindConfig(kind: WriteKind): KindConfig {
  if (kind === 'note') {
    return {
      description: translate('write.kindDescription.note'),
      icon: BookOpen,
      listPath: '/notes',
      title: translate('write.header.titleNote'),
    }
  }
  if (kind === 'page') {
    return {
      description: translate('write.kindDescription.page'),
      icon: FileIcon,
      listPath: '/pages',
      title: translate('write.header.titlePage'),
    }
  }
  return {
    description: translate('write.kindDescription.post'),
    icon: FileText,
    listPath: '/posts',
    title: translate('write.header.titlePost'),
  }
}

function getDraftKindLabel(kind: WriteKind) {
  if (kind === 'note') return translate('write.kind.note')
  if (kind === 'page') return translate('write.kind.page')
  return translate('write.kind.post')
}

export function PostWritePageContent() {
  return <WritePage kind="post" />
}

export function NoteWritePageContent() {
  return <WritePage kind="note" />
}

export function PageWritePageContent() {
  return <WritePage kind="page" />
}

function WritePage(props: { kind: WriteKind }) {
  const { t } = useI18n()
  const config = getKindConfig(props.kind)
  const Icon = config.icon
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const routeDraftId = searchParams.get('draftId') ?? ''
  const isEditing = Boolean(id)
  const [preferredContentFormat, setPreferredContentFormat] =
    useLocalStorageState<ContentFormat>(
      PREFERRED_CONTENT_FORMAT_STORAGE_KEY,
      'markdown',
    )
  const [state, setState] = useState<WriteFormState>(() => ({
    ...emptyState,
    contentFormat: preferredContentFormat,
  }))
  useDocumentTitle(state.title)
  const [asidePanel, setAsidePanel] = useState<
    'agent' | 'meta' | 'drafts' | null
  >(null)
  const agentVisible = asidePanel === 'agent'
  const metaPanelOpen = asidePanel === 'meta'
  const draftsPanelOpen = asidePanel === 'drafts'
  const toggleAsidePanel = (panel: 'agent' | 'meta' | 'drafts') =>
    setAsidePanel((current) => (current === panel ? null : panel))
  const [draftId, setDraftId] = useState('')
  const [pageParseDialogOpen, setPageParseDialogOpen] = useState(false)
  const [pageLexicalDebugOpen, setPageLexicalDebugOpen] = useState(false)
  const [draftListHintDismissed, setDraftListHintDismissed] = useState(false)
  const [recoveryHintDismissed, setRecoveryHintDismissed] = useState(false)
  const [previewingDraft, setPreviewingDraft] = useState<DraftModel | null>(
    null,
  )
  const previewSnapshotRef = useRef<{
    state: WriteFormState
    draftId: string
  } | null>(null)
  const appliedRouteDraftIdRef = useRef<string | null>(null)
  const formSeededKeyRef = useRef<string | null>(null)
  const draftDirtyRef = useRef(false)
  const lastSavedDraftFingerprintRef = useRef('')
  const latestDraftFingerprintRef = useRef('')
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState('')
  const draftRefType = draftRefTypeByKind[props.kind]

  useCollectionListQuery(categoriesCollection, {
    enabled: props.kind === 'post',
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: adminQueryKeys.categories.list(),
    toPage: (result) => ({ items: result }),
  })
  const categoriesList = useEntityList(
    categoriesCollection,
    adminQueryKeys.categories.list(),
  )
  useCollectionListQuery(topicsCollection, {
    enabled: props.kind === 'note',
    queryFn: () => getTopics({ page: 1, size: 100 }),
    queryKey: adminQueryKeys.topics.list({ page: 1, size: 100 }),
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })
  const topicsList = useEntityList(
    topicsCollection,
    adminQueryKeys.topics.list({ page: 1, size: 100 }),
  )
  const tagsQuery = useQuery({
    enabled: props.kind === 'post',
    queryFn: getTags,
    queryKey: adminQueryKeys.categories.tags(),
  })
  useCollectionListQuery(postsCollection, {
    enabled: props.kind === 'post',
    queryFn: () =>
      getPosts({
        page: 1,
        size: 100,
        sort_by: 'createdAt',
        sort_order: 'desc',
      }),
    queryKey: adminQueryKeys.posts.relatedOptions('write'),
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })
  const relatedPostsList = useEntityList(
    postsCollection,
    adminQueryKeys.posts.relatedOptions('write'),
  )
  const postDetailQuery = useCollectionDetailQuery(postsCollection, {
    enabled: isEditing && props.kind === 'post',
    queryFn: () => getPostById(id),
    queryKey: adminQueryKeys.write.detail({ id, kind: 'post' }),
  })
  const postEntity = useEntity(
    postsCollection,
    props.kind === 'post' && isEditing ? id : undefined,
  )
  const noteDetailQuery = useCollectionDetailQuery(notesCollection, {
    enabled: isEditing && props.kind === 'note',
    queryFn: () => getNoteById(id, { single: true }),
    queryKey: adminQueryKeys.write.detail({ id, kind: 'note' }),
  })
  const noteEntity = useEntity(
    notesCollection,
    props.kind === 'note' && isEditing ? id : undefined,
  )
  const pageDetailQuery = useCollectionDetailQuery(pagesCollection, {
    enabled: isEditing && props.kind === 'page',
    queryFn: () => getPageById(id),
    queryKey: adminQueryKeys.write.detail({ id, kind: 'page' }),
  })
  const pageEntity = useEntity(
    pagesCollection,
    props.kind === 'page' && isEditing ? id : undefined,
  )
  const storeEntity =
    props.kind === 'note'
      ? noteEntity
      : props.kind === 'page'
        ? pageEntity
        : postEntity
  const storeDetailQuery =
    props.kind === 'note'
      ? noteDetailQuery
      : props.kind === 'page'
        ? pageDetailQuery
        : postDetailQuery
  const detailModel: WriteModel | undefined = storeEntity
  const isDetailLoaded = storeDetailQuery.isSuccess
  const detailLoading = storeDetailQuery.isLoading
  const refDraftQuery = useQuery({
    enabled: isEditing,
    queryFn: () => getDraftByRef(draftRefType, id),
    queryKey: adminQueryKeys.drafts.byRef({ id, refType: draftRefType }),
  })
  const routeDraftQuery = useQuery({
    enabled: Boolean(routeDraftId),
    queryFn: () => getDraftById(routeDraftId),
    queryKey: adminQueryKeys.drafts.detail(routeDraftId),
  })
  const newDraftsQuery = useQuery({
    enabled: !isEditing,
    queryFn: () => getNewDrafts(draftRefType),
    queryKey: adminQueryKeys.drafts.newDraft(draftRefType),
  })

  const categories = categoriesList.items
  const tags = tagsQuery.data ?? []
  const topics = topicsList.items
  const relatedPosts = relatedPostsList.items
  const firstCategoryId = categories[0]?.id ?? ''
  const activeCategory =
    categories.find((category) => category.id === state.categoryId) ??
    categories[0]
  const availableDraft = useMemo(() => {
    if (refDraftQuery.data) return refDraftQuery.data

    return [...(newDraftsQuery.data ?? [])].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )[0]
  }, [newDraftsQuery.data, refDraftQuery.data])
  const publishedContent = useMemo(
    () => (detailModel ? getPublishedContent(detailModel) : null),
    [detailModel],
  )
  const defaultNoteTitle = useMemo(() => {
    if (props.kind === 'note' && detailModel) {
      return getDefaultNoteTitle(new Date((detailModel as NoteModel).createdAt))
    }

    return getDefaultNoteTitle()
  }, [detailModel, props.kind])
  const notePublicPath =
    props.kind === 'note'
      ? buildNotePublicPath(state, detailModel as NoteModel | undefined)
      : ''
  const postPublicPath =
    props.kind === 'post' ? buildPostPublicPath(state, activeCategory) : ''
  const draftFingerprint = useMemo(
    () =>
      JSON.stringify(
        toDraftData(props.kind, state, isEditing ? id : undefined, {
          project: false,
        }),
      ),
    [id, isEditing, props.kind, state],
  )
  const hasDraftAutosaveContent =
    state.title.trim().length > 0 ||
    state.text.trim().length > 0 ||
    state.content.trim().length > 0
  const canSwitchEditorType = !state.text.trim() && !state.content.trim()

  useEffect(() => {
    latestDraftFingerprintRef.current = draftFingerprint
  }, [draftFingerprint])

  const hasUnsavedDraftChanges = () =>
    draftDirtyRef.current &&
    hasDraftAutosaveContent &&
    latestDraftFingerprintRef.current !== lastSavedDraftFingerprintRef.current

  useBeforeUnload(
    (event) => {
      if (!hasUnsavedDraftChanges()) return
      event.preventDefault()
    },
    { capture: true },
  )

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedDraftChanges() &&
      currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void confirmDialog({
      title: t('write.confirmLeave.title'),
      description: t('write.confirmLeave.description'),
      confirmText: t('common.leave'),
    }).then((ok) => {
      if (ok) blocker.proceed()
      else blocker.reset()
    })
  }, [blocker, t])

  useEffect(() => {
    if (!detailModel || !isDetailLoaded) {
      if (props.kind !== 'post' || !firstCategoryId) return
      setState((previous) =>
        previous.categoryId
          ? previous
          : {
              ...previous,
              categoryId: firstCategoryId,
            },
      )
      return
    }

    if (routeDraftId) return

    const seedKey = `${props.kind}:${id}`
    if (formSeededKeyRef.current === seedKey) return
    formSeededKeyRef.current = seedKey

    setState(fromModel(props.kind, detailModel))
  }, [
    detailModel,
    firstCategoryId,
    id,
    isDetailLoaded,
    props.kind,
    routeDraftId,
  ])

  useEffect(() => {
    if (refDraftQuery.data && !draftId) {
      setDraftId(refDraftQuery.data.id)
    }
  }, [draftId, refDraftQuery.data])

  const recoveryHintDraft = useMemo(() => {
    const draft = refDraftQuery.data
    const published = detailModel
    if (!isEditing || routeDraftId || !draft || !published) return null
    if (!isDraftNewerThanPublished(draft, published)) return null
    return draft
  }, [detailModel, isEditing, refDraftQuery.data, routeDraftId])

  useEffect(() => {
    const draft = routeDraftQuery.data
    if (!draft || appliedRouteDraftIdRef.current === draft.id) return

    if (draft.refType !== draftRefType) {
      toast.error(t('write.toast.draftTypeMismatch'))
      appliedRouteDraftIdRef.current = draft.id
      return
    }

    appliedRouteDraftIdRef.current = draft.id
    setDraftId(draft.id)
    setState((previous) => fromDraft(props.kind, draft, previous))

    if (draft.refId && !id) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('id', draft.refId)
      nextParams.set('draftId', draft.id)
      setSearchParams(nextParams, { replace: true })
    }
  }, [
    draftRefType,
    id,
    props.kind,
    routeDraftQuery.data,
    searchParams,
    setSearchParams,
  ])

  const saveMutation = useMutation<WriteModel>({
    mutationFn: () => saveWrite(props.kind, id, state, draftId || undefined),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('write.toast.saveFailed'))),
    onSuccess: async (result) => {
      draftDirtyRef.current = false
      lastSavedDraftFingerprintRef.current = latestDraftFingerprintRef.current
      setLastSavedFingerprint(latestDraftFingerprintRef.current)
      toast.success(
        isEditing ? t('write.toast.saved') : t('write.toast.createOk'),
      )
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.write.contentRoot(props.kind),
      })
      if (props.kind === 'page') {
        navigate(config.listPath)
        return
      }
      if (!isEditing) {
        const nextParams = new URLSearchParams(searchParams)
        nextParams.set('id', result.id)
        setSearchParams(nextParams, { replace: true })
      }
    },
  })
  const draftMutation = useMutation({
    mutationFn: () => {
      const data = toDraftData(props.kind, state, isEditing ? id : undefined)
      return draftId ? updateDraft(draftId, data) : createDraft(data)
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('write.toast.draftSaveFailed'))),
    onSuccess: async (draft) => {
      const isFirstDraftSave = !draftId
      setDraftId(draft.id)
      draftDirtyRef.current = false
      lastSavedDraftFingerprintRef.current = latestDraftFingerprintRef.current
      setLastSavedFingerprint(latestDraftFingerprintRef.current)
      if (isFirstDraftSave && searchParams.get('draftId') !== draft.id) {
        const nextParams = new URLSearchParams(searchParams)
        nextParams.set('draftId', draft.id)
        setSearchParams(nextParams, { replace: true })
      }
      toast.success(t('write.toast.draftSaved'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.drafts.root }),
        isEditing ? refDraftQuery.refetch() : newDraftsQuery.refetch(),
      ])
    },
  })
  const draftMutationRef = useRef(draftMutation)
  draftMutationRef.current = draftMutation
  const writerGenerateMutation = useMutation({
    mutationFn: () => {
      const trimmedTitle = state.title.trim()
      const trimmedText = state.text.trim()

      if (trimmedTitle) {
        return writerGenerate({
          title: trimmedTitle,
          type: AiQueryType.Slug,
        })
      }

      return writerGenerate({
        text: trimmedText,
        type: AiQueryType.TitleSlug,
      })
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('write.toast.aiGenerateFailed'))),
    onSuccess: (result) => {
      draftDirtyRef.current = true
      setState((previous) => ({
        ...previous,
        slug: result.slug || previous.slug,
        title: result.title || previous.title,
      }))
      toast.success(t('write.toast.aiApplied'))
    },
  })

  const validationError = useMemo(
    () => validateState(props.kind, state, categories, isEditing),
    [categories, isEditing, props.kind, state],
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (validationError) {
      toast.error(validationError)
      return
    }

    saveMutation.mutate()
  }
  useEffect(() => {
    if (!draftDirtyRef.current) return
    if (!hasDraftAutosaveContent) return
    if (draftFingerprint === lastSavedDraftFingerprintRef.current) return

    const timer = window.setTimeout(() => {
      if (!draftDirtyRef.current || draftMutationRef.current.isPending) return
      draftMutationRef.current.mutate()
    }, 10000)

    return () => window.clearTimeout(timer)
  }, [draftFingerprint, hasDraftAutosaveContent])

  const updateField = <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => {
    draftDirtyRef.current = true
    setState((previous) => ({ ...previous, [key]: value }))
  }

  const updateContentFormat = (format: ContentFormat) => {
    setPreferredContentFormat(format)
    updateField('contentFormat', format)
  }

  const getAgentMetaFields = () => getWriteAgentMetaFields(props.kind, state)

  const applyAgentMetaUpdates = (updates: Record<string, unknown>) => {
    draftDirtyRef.current = true
    setState((previous) =>
      applyWriteAgentMetaUpdates(props.kind, previous, updates),
    )
  }

  const applyDraft = (draft: DraftModel) => {
    draftDirtyRef.current = true
    setDraftId(draft.id)
    setState((previous) => fromDraft(props.kind, draft, previous))
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('draftId', draft.id)
    if (draft.refId) nextParams.set('id', draft.refId)
    setSearchParams(nextParams, { replace: true })
    toast.success(t('write.toast.draftApplied'))
  }

  const enterDraftPreview = (draft: DraftModel) => {
    if (!previewingDraft) {
      previewSnapshotRef.current = { state, draftId }
    }
    setPreviewingDraft(draft)
    setState((previous) => fromDraft(props.kind, draft, previous))
    setDraftId(draft.id)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('draftId', draft.id)
    if (draft.refId) nextParams.set('id', draft.refId)
    setSearchParams(nextParams, { replace: true })
  }

  const commitDraftPreview = () => {
    draftDirtyRef.current = true
    previewSnapshotRef.current = null
    setPreviewingDraft(null)
    toast.success(t('write.toast.draftApplied'))
  }

  const cancelDraftPreview = () => {
    const snap = previewSnapshotRef.current
    if (snap) {
      setState(snap.state)
      setDraftId(snap.draftId)
      const nextParams = new URLSearchParams(searchParams)
      if (snap.draftId) nextParams.set('draftId', snap.draftId)
      else nextParams.delete('draftId')
      setSearchParams(nextParams, { replace: true })
    }
    previewSnapshotRef.current = null
    setPreviewingDraft(null)
  }

  const closeDraftsPanel = () => {
    if (previewingDraft) cancelDraftPreview()
    setAsidePanel(null)
  }

  const generateTitleOrSlug = () => {
    if (!state.title.trim() && !state.text.trim()) {
      toast.error(t('write.slugGenerate.bothMissing'))
      return
    }

    writerGenerateMutation.mutate()
  }

  const saveDraftNow = () => {
    if (!hasDraftAutosaveContent) {
      toast.error(t('write.toast.contentEmptyForDraft'))
      return
    }
    if (draftMutation.isPending) return

    draftMutation.mutate()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveDraftNow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveDraftNow])

  const copyPageUrl = () => {
    if (!state.slug.trim()) return

    void navigator.clipboard
      .writeText(`${WEB_URL}/${state.slug.trim()}`)
      .then(() => toast.success(t('write.editor.copyLinkOk')))
      .catch(() => toast.error(t('write.toast.copyFailed')))
  }

  const latestDraft = draftMutation.data ?? availableDraft
  const draftListHintCount =
    !isEditing && !routeDraftId ? (newDraftsQuery.data?.length ?? 0) : 0
  const showDraftListHint = draftListHintCount > 0 && !draftListHintDismissed
  const showRecoveryHint = Boolean(
    recoveryHintDraft && publishedContent && !recoveryHintDismissed,
  )
  const draftKindText = getDraftKindLabel(props.kind)
  const isDirty =
    hasDraftAutosaveContent && draftFingerprint !== lastSavedFingerprint
  const metaStatus = computeMetaStatus({
    isDirty,
    isEditing,
    isPendingDraftSave: draftMutation.isPending,
    latestDraft,
    publishedUpdatedAt: detailModel
      ? getPublishedContent(detailModel).updatedAt
      : undefined,
  })

  const slugPathPrefix =
    props.kind === 'post'
      ? `/posts/${activeCategory?.slug ?? ''}/`
      : props.kind === 'page'
        ? '/'
        : ''
  const slugDisplayPath = state.slug.trim()
    ? `${slugPathPrefix}${state.slug.trim()}`
    : ''
  const aiButtonVisible =
    state.text.trim().length > 0 &&
    (props.kind === 'note' ||
      (props.kind === 'post' && (!state.title.trim() || !state.slug.trim())) ||
      (props.kind === 'page' && !state.slug.trim()))

  const titlePlaceholder =
    props.kind === 'note'
      ? defaultNoteTitle
      : t('write.editor.titlePlaceholder')

  const subtitleNode: ReactNode =
    props.kind === 'page' ? (
      <input
        className="outline-hidden mt-1 w-full border-0 bg-transparent px-0 text-base text-neutral-500 placeholder:text-neutral-300 dark:text-neutral-400 dark:placeholder:text-neutral-700"
        onChange={(event) => updateField('subtitle', event.target.value)}
        placeholder={t('write.editor.subtitlePlaceholder')}
        value={state.subtitle}
      />
    ) : null

  return (
    <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
      <section
        className="flex h-full min-h-0 flex-col bg-background"
        style={
          {
            '--app-shell-header-height': APP_SHELL_HEADER_HEIGHT_VALUE,
          } as CSSProperties
        }
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
            APP_SHELL_HEADER_HEIGHT_CLASS,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <HeaderBackButton
              label={t('write.header.backToList')}
              to={config.listPath}
            />
            <h2 className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">
                {props.kind === 'page'
                  ? isEditing
                    ? t('write.header.editPage')
                    : t('write.header.newPage')
                  : config.title}
              </span>
            </h2>
            <DraftStatusTag
              className="hidden md:inline-flex"
              draft={draftMutation.data ?? availableDraft}
              isSaving={draftMutation.isPending}
            />
          </div>
          {props.kind === 'page' ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {state.contentFormat === 'markdown' ? (
                <WriteHeaderIconButton
                  onClick={() => setPageParseDialogOpen(true)}
                  title={t('write.pill.parseMd')}
                  type="button"
                >
                  <Hash aria-hidden="true" className="size-4" />
                </WriteHeaderIconButton>
              ) : (
                <WriteHeaderIconButton
                  onClick={() => setPageLexicalDebugOpen(true)}
                  title={t('write.pill.lexicalDebug')}
                  type="button"
                >
                  <Bug aria-hidden="true" className="size-4" />
                </WriteHeaderIconButton>
              )}
              <WriteHeaderIconButton
                onClick={() => toggleAsidePanel('meta')}
                title={
                  metaPanelOpen
                    ? t('write.pageHeader.hidePageSettings')
                    : t('write.pageHeader.pageSettings')
                }
                type="button"
                variant={metaPanelOpen ? 'active' : 'default'}
              >
                <SlidersHorizontal aria-hidden="true" className="size-4" />
              </WriteHeaderIconButton>
              <WriteHeaderIconButton
                disabled={saveMutation.isPending || detailLoading}
                title={t('write.header.publish')}
                type="submit"
                variant="primary"
              >
                {saveMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="size-4" />
                )}
              </WriteHeaderIconButton>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              <WriteHeaderIconButton
                disabled={state.contentFormat !== 'lexical'}
                onClick={() => toggleAsidePanel('agent')}
                title={
                  agentVisible ? t('write.pill.hideAi') : t('write.pill.showAi')
                }
                type="button"
                variant={agentVisible ? 'active' : 'default'}
              >
                <Bot aria-hidden="true" className="size-4" />
              </WriteHeaderIconButton>
              <WriteHeaderIconButton
                onClick={() => toggleAsidePanel('meta')}
                title={
                  metaPanelOpen
                    ? props.kind === 'post'
                      ? t('write.pill.hidePostSettings')
                      : t('write.pill.hideNoteSettings')
                    : props.kind === 'post'
                      ? t('write.pill.postSettings')
                      : t('write.pill.noteSettings')
                }
                type="button"
                variant={metaPanelOpen ? 'active' : 'default'}
              >
                <SlidersHorizontal aria-hidden="true" className="size-4" />
              </WriteHeaderIconButton>
              <WriteHeaderIconButton
                disabled={saveMutation.isPending || detailLoading}
                title={t('write.header.publish')}
                type="submit"
                variant="primary"
              >
                {saveMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="size-4" />
                )}
              </WriteHeaderIconButton>
            </div>
          )}
        </div>

        <ContentLayout
          className="min-h-0 flex-1"
          mainClassName="flex flex-col"
          onCloseAside={() => {
            if (draftsPanelOpen && previewingDraft) cancelDraftPreview()
            setAsidePanel(null)
          }}
          open={asidePanel !== null && !detailLoading}
        >
          {detailLoading ? (
            <div className="min-h-0 flex-1">
              <WriteSkeleton kind={props.kind} />
            </div>
          ) : (
            <Scroll
              className="min-h-0 flex-1"
              innerClassName="min-h-full bg-background"
            >
              <main className="flex min-h-full min-w-0 flex-col bg-background">
                <div className="mx-auto w-full max-w-5xl shrink-0 px-3 pt-8">
                  {showDraftListHint ? (
                    <div className="mb-3 -mt-4">
                      <DraftHintBanner
                        actionLabel={t('write.draftList.hintAction')}
                        message={t('write.draftList.hintMessage', {
                          count: draftListHintCount,
                          label: draftKindText,
                        })}
                        onAction={() => setAsidePanel('drafts')}
                        onDismiss={() => setDraftListHintDismissed(true)}
                        variant="list"
                      />
                    </div>
                  ) : null}
                  {showRecoveryHint && recoveryHintDraft ? (
                    <div className="mb-3">
                      <DraftHintBanner
                        actionLabel={t('write.recovery.compareAction')}
                        message={t('write.recovery.draftHasNew', {
                          label: draftKindText,
                          version: recoveryHintDraft.version,
                        })}
                        onAction={() => {
                          setAsidePanel('drafts')
                          enterDraftPreview(recoveryHintDraft)
                        }}
                        onDismiss={() => setRecoveryHintDismissed(true)}
                        variant="recovery"
                      />
                    </div>
                  ) : null}
                  {previewingDraft ? (
                    <div className="mb-3">
                      <DraftPreviewBanner
                        draftLabel={t('write.preview.banner.label', {
                          version: previewingDraft.version,
                          time: formatRelativeTime(previewingDraft.updatedAt),
                        })}
                        onApply={commitDraftPreview}
                        onCancel={cancelDraftPreview}
                      />
                    </div>
                  ) : null}
                  <EditorMetaStrip
                    aiButtonPending={writerGenerateMutation.isPending}
                    aiButtonVisible={aiButtonVisible}
                    canSwitchFormat={canSwitchEditorType}
                    format={state.contentFormat}
                    onAiGenerate={generateTitleOrSlug}
                    onToggleFormat={() =>
                      updateContentFormat(
                        state.contentFormat === 'lexical'
                          ? 'markdown'
                          : 'lexical',
                      )
                    }
                    status={metaStatus.status}
                    statusText={metaStatus.text}
                  />
                  <EditorTitleArea
                    autoFocus={!isEditing}
                    copyPageUrl={
                      props.kind === 'page' ? copyPageUrl : undefined
                    }
                    displayPath={slugDisplayPath}
                    onSlugChange={(value) => updateField('slug', value)}
                    onTitleChange={(value) => updateField('title', value)}
                    placeholder={titlePlaceholder}
                    required={props.kind !== 'note'}
                    showSlugPill={props.kind !== 'note'}
                    slug={state.slug}
                    slugPlaceholder={
                      props.kind === 'page' ? 'slug' : 'slug-of-this-post'
                    }
                    slugPrefix={slugPathPrefix}
                    subtitle={subtitleNode}
                    title={state.title}
                  />
                  <hr className="my-4 border-0 border-t border-neutral-100 dark:border-neutral-900" />
                </div>

                <div
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    state.contentFormat !== 'lexical' && 'pb-[200px]',
                  )}
                >
                  <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-3">
                    {state.contentFormat === 'lexical' ? (
                      <RichWriteSurface
                        agentVisible={agentVisible}
                        autoFocus={isEditing}
                        content={state.content}
                        contentClassName="!min-h-[60vh] flex-1 px-0 pt-3 pb-[200px]"
                        kind={props.kind}
                        key={`${props.kind}:${id || 'new'}:${state.contentFormat}`}
                        getMetaFields={getAgentMetaFields}
                        metaFieldsSchema={getWriteAgentMetaSchema(props.kind)}
                        onContentChange={(content) =>
                          updateField('content', content)
                        }
                        onMetaFieldsUpdate={applyAgentMetaUpdates}
                        onPinSelection={() => setAsidePanel('agent')}
                        onTextChange={(text) => updateField('text', text)}
                        refId={isEditing ? id : routeDraftId || undefined}
                        surfaceClassName="flex min-h-[70vh] flex-1 flex-col rounded-none border-0 bg-transparent dark:bg-transparent"
                        surfaceStyle={
                          {
                            '--rc-max-width': 'none',
                          } as CSSProperties
                        }
                      />
                    ) : (
                      <>
                        <CodeMirrorEditor
                          autoFocus={isEditing}
                          className="min-h-136 rounded-none border-0 bg-transparent px-0 py-6"
                          onChange={(value) => updateField('text', value)}
                          style={{ minHeight: '34rem' }}
                          text={state.text}
                        />
                        <ImageDropZone />
                      </>
                    )}
                  </div>
                </div>
              </main>
            </Scroll>
          )}
          <ContentLayoutSlot active={draftsPanelOpen} id="drafts">
            <DraftsAsidePanel
              drafts={[...(newDraftsQuery.data ?? [])].sort(
                (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
              )}
              draftKindLabel={draftKindText}
              onClose={closeDraftsPanel}
              onPreview={enterDraftPreview}
              previewingDraftId={previewingDraft?.id ?? null}
              recoveryDraftId={recoveryHintDraft?.id ?? null}
            />
          </ContentLayoutSlot>
          <ContentLayoutSlot active={metaPanelOpen} id="meta">
            {props.kind === 'page' ? (
              <PageSettingsPanel state={state} updateField={updateField} />
            ) : (
              <ContentSettingsPanel
                availableDraft={availableDraft}
                draftMutationData={draftMutation.data}
                draftMutationPending={draftMutation.isPending}
                kind={props.kind}
                noteFields={
                  props.kind === 'note' ? (
                    <NoteFields
                      state={state}
                      topics={topics}
                      updateField={updateField}
                    />
                  ) : null
                }
                onApplyDraft={applyDraft}
                onGenerateTitleOrSlug={generateTitleOrSlug}
                onSaveDraft={saveDraftNow}
                postFields={
                  props.kind === 'post' ? (
                    <PostFields
                      categories={categories}
                      currentPostId={id}
                      relatedPosts={relatedPosts}
                      state={state}
                      tags={tags}
                      updateField={updateField}
                    />
                  ) : null
                }
                publicPath={
                  props.kind === 'note'
                    ? notePublicPath
                      ? `${WEB_URL}${notePublicPath}`
                      : t('write.notePublicPath.fallback')
                    : postPublicPath
                      ? `${WEB_URL}${postPublicPath}`
                      : t('write.postPublicPath.fallback')
                }
                saveResultId={saveMutation.data?.id}
                state={state}
                updateField={updateField}
                writerGeneratePending={writerGenerateMutation.isPending}
              />
            )}
          </ContentLayoutSlot>
        </ContentLayout>
      </section>

      {props.kind === 'page' ? (
        <PageParseMarkdownDialog
          onApply={(parsed) => {
            setState((previous) => applyParsedPageMarkdown(previous, parsed))
            setPageParseDialogOpen(false)
            toast.success(t('write.parseMd.success'))
          }}
          onClose={() => setPageParseDialogOpen(false)}
          open={pageParseDialogOpen}
        />
      ) : null}
      {props.kind === 'page' ? (
        <PageLexicalDebugDialog
          content={state.content}
          onClose={() => setPageLexicalDebugOpen(false)}
          open={pageLexicalDebugOpen}
        />
      ) : null}
    </form>
  )
}

function ContentSettingsPanel(props: {
  availableDraft?: DraftModel
  draftMutationData?: DraftModel
  draftMutationPending: boolean
  kind: Exclude<WriteKind, 'page'>
  noteFields: ReactNode
  onApplyDraft: (draft: DraftModel) => void
  onGenerateTitleOrSlug: () => void
  onSaveDraft: () => void
  postFields: ReactNode
  publicPath: string
  saveResultId?: string
  state: WriteFormState
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
  writerGeneratePending: boolean
}) {
  const { t } = useI18n()
  return (
    <AsidePanel>
      <Scroll
        className="min-h-0 flex-1"
        innerClassName="grid grid-cols-[minmax(0,1fr)] gap-4 p-4"
      >
        <PanelBlock title={t('write.section.publish.title')}>
          <Switch
            checked={props.state.isPublished}
            label={t('write.section.path.publishLabel')}
            onCheckedChange={(checked) =>
              props.updateField('isPublished', checked)
            }
          />
          {props.saveResultId ? (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <Check aria-hidden="true" className="size-4" />
              {t('write.section.path.savedId', { id: props.saveResultId })}
            </div>
          ) : null}
        </PanelBlock>

        <PanelBlock title={t('write.section.draft.title')}>
          <div className="space-y-3 text-sm">
            {props.availableDraft ? (
              <div className="border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <History aria-hidden="true" className="size-4" />
                  <span>
                    {t('write.section.draft.versionLine', {
                      version: props.availableDraft.version,
                      time: formatDateTime(props.availableDraft.updatedAt),
                    })}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-neutral-800 dark:text-neutral-200">
                  {props.availableDraft.title ||
                    t('write.section.draft.untitled')}
                </p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => props.onApplyDraft(props.availableDraft!)}
                  type="button"
                  variant="subtle"
                >
                  {t('write.section.draft.applyDraft')}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('write.section.draft.empty')}
              </p>
            )}

            <Button
              className="w-full"
              disabled={props.draftMutationPending}
              onClick={props.onSaveDraft}
              type="button"
              variant="subtle"
            >
              {props.draftMutationPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Clock aria-hidden="true" className="size-4" />
              )}
              {t('write.section.draft.save')}
            </Button>
            {props.draftMutationData ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('write.section.draft.lastSaved', {
                  time: formatDateTime(props.draftMutationData.updatedAt),
                })}
              </p>
            ) : null}
          </div>
        </PanelBlock>

        <PanelBlock title={t('write.section.path.title')}>
          <TextInput
            controlClassName="h-9 font-mono focus:border-neutral-400"
            label="Slug"
            onChange={(value) => props.updateField('slug', value)}
            required={props.kind !== 'note'}
            value={props.state.slug}
          />
          <Button
            className="w-full"
            disabled={props.writerGeneratePending}
            onClick={props.onGenerateTitleOrSlug}
            type="button"
            variant="subtle"
          >
            {props.writerGeneratePending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <WandSparkles aria-hidden="true" className="size-4" />
            )}
            {props.state.title.trim()
              ? t('write.slugGenerate.haveTitle')
              : t('write.slugGenerate.noTitle')}
          </Button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {props.publicPath}
          </p>
        </PanelBlock>

        {props.postFields}
        {props.noteFields}
        <MediaAndMetaFields
          kind={props.kind}
          state={props.state}
          updateField={props.updateField}
        />
      </Scroll>
    </AsidePanel>
  )
}

function DraftsAsidePanel(props: {
  drafts: DraftModel[]
  draftKindLabel: string
  onClose: () => void
  onPreview: (draft: DraftModel) => void
  previewingDraftId: string | null
  recoveryDraftId: string | null
}) {
  const { t } = useI18n()

  return (
    <AsidePanel
      icon={History}
      onClose={props.onClose}
      title={t('write.draftList.title')}
    >
      {props.drafts.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState
            description={t('write.draftList.empty.description', {
              label: props.draftKindLabel,
            })}
            icon={History}
            title={t('write.draftList.empty.title')}
          />
        </div>
      ) : (
        <Scroll
          className="min-h-0 flex-1"
          innerClassName="flex flex-col gap-1 p-2"
        >
          {props.drafts.map((draft) => {
            const isPreviewing = draft.id === props.previewingDraftId
            const isRecovery = draft.id === props.recoveryDraftId
            return (
              <button
                aria-current={isPreviewing}
                className={cn(
                  'group relative flex w-full min-w-0 items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors',
                  'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                  isPreviewing
                    ? 'bg-accent-soft text-fg'
                    : 'hover:bg-surface-inset',
                )}
                key={draft.id}
                onClick={() => props.onPreview(draft)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent',
                    isPreviewing ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <History
                  aria-hidden="true"
                  className="size-4 shrink-0 text-fg-muted"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {draft.title || t('write.editor.untitled')}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-fg-muted">
                    {t('write.draftList.row.meta', {
                      version: draft.version,
                      time: formatRelativeTime(draft.updatedAt),
                    })}
                  </span>
                </span>
                {isRecovery ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-amber-500"
                    />
                    <span className="truncate">
                      {t('write.draftList.newerLabel')}
                    </span>
                  </span>
                ) : null}
              </button>
            )
          })}
        </Scroll>
      )}
    </AsidePanel>
  )
}

interface PublishedWriteContent {
  content?: string
  contentFormat?: ContentFormat
  text: string
  title: string
  updatedAt: string
}

function WriteHeaderIconButton(props: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  title: string
  type: 'button' | 'submit'
  variant?: 'default' | 'primary' | 'active'
}) {
  const variant = props.variant ?? 'default'
  return (
    <button
      aria-label={props.title}
      aria-pressed={variant === 'active' ? true : undefined}
      className={cn(
        'focus-visible:outline-hidden inline-flex size-9 items-center justify-center rounded-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
        variant === 'active' &&
          'bg-accent-soft text-accent ring-1 ring-inset ring-accent/25 hover:bg-accent-soft/80',
        variant === 'default' &&
          'bg-surface-inset text-fg-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.08]',
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      type={props.type}
    >
      {props.children}
    </button>
  )
}

type MetaStatus = 'new' | 'dirty' | 'saved' | 'published'

function computeMetaStatus(input: {
  isDirty: boolean
  isEditing: boolean
  isPendingDraftSave: boolean
  latestDraft?: DraftModel
  publishedUpdatedAt?: string
}): { status: MetaStatus; text: string } {
  if (input.isPendingDraftSave) {
    return { status: 'dirty', text: translate('write.metaStatus.dirtySaving') }
  }
  if (input.isDirty) {
    const versionSuffix = input.latestDraft
      ? translate('write.metaStatus.versionSuffix', {
          version: input.latestDraft.version,
        })
      : ''
    return {
      status: 'dirty',
      text: translate('write.metaStatus.dirty', { version: versionSuffix }),
    }
  }
  if (input.latestDraft) {
    const savedAt =
      input.latestDraft.updatedAt ?? input.latestDraft.createdAt ?? ''
    const suffix = savedAt
      ? translate('write.metaStatus.savedAt', {
          time: formatRelativeTime(savedAt),
        })
      : ''
    return {
      status: 'saved',
      text: translate('write.metaStatus.draft', {
        version: input.latestDraft.version,
        suffix,
      }),
    }
  }
  if (input.isEditing && input.publishedUpdatedAt) {
    return {
      status: 'published',
      text: translate('write.metaStatus.published', {
        time: formatRelativeTime(input.publishedUpdatedAt),
      }),
    }
  }
  return { status: 'new', text: translate('write.metaStatus.new') }
}

function formatRelativeTime(value: string | null | undefined) {
  if (value == null || value === '') return '-'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return '-'
  const diffMs = Date.now() - ts
  if (diffMs < 0) return formatDateTime(value)
  const sec = Math.round(diffMs / 1000)
  if (sec < 45) return translate('write.relativeTime.justNow')
  const min = Math.round(sec / 60)
  if (min < 60)
    return translate('write.relativeTime.minutesAgo', { count: min })
  const hr = Math.round(min / 60)
  if (hr < 24) return translate('write.relativeTime.hoursAgo', { count: hr })
  const day = Math.round(hr / 24)
  if (day < 7) return translate('write.relativeTime.daysAgo', { count: day })
  return formatDateTime(value)
}

function EditorMetaStrip(props: {
  aiButtonPending: boolean
  aiButtonVisible: boolean
  canSwitchFormat: boolean
  format: ContentFormat
  onAiGenerate: () => void
  onToggleFormat: () => void
  status: MetaStatus
  statusText: string
}) {
  const { t } = useI18n()
  const dotClass =
    props.status === 'dirty'
      ? 'bg-amber-500'
      : props.status === 'saved' || props.status === 'published'
        ? 'bg-emerald-500'
        : 'bg-neutral-300 dark:bg-neutral-600'
  const formatLabel =
    props.format === 'lexical'
      ? t('write.format.toMarkdown')
      : t('write.format.toLexical')

  return (
    <div className="group mb-3 flex min-h-7 items-center justify-between opacity-60 transition-opacity duration-200 hover:opacity-100">
      <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            dotClass,
          )}
        />
        <span className="truncate">{props.statusText}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {props.canSwitchFormat ? (
          <button
            aria-label={formatLabel}
            className="focus-visible:outline-hidden inline-flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-1 focus-visible:ring-neutral-400 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            onClick={props.onToggleFormat}
            title={formatLabel}
            type="button"
          >
            <ArrowLeftRight aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
        {props.aiButtonVisible ? (
          <button
            aria-label={t('write.pill.aiGenerate')}
            className="focus-visible:outline-hidden inline-flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            disabled={props.aiButtonPending}
            onClick={props.onAiGenerate}
            title={t('write.pill.aiGenerate')}
            type="button"
          >
            {props.aiButtonPending ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <WandSparkles aria-hidden="true" className="size-3.5" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function EditorTitleArea(props: {
  autoFocus: boolean
  copyPageUrl?: () => void
  displayPath: string
  onSlugChange: (value: string) => void
  onTitleChange: (value: string) => void
  placeholder: string
  required: boolean
  showSlugPill: boolean
  slug: string
  slugPlaceholder: string
  slugPrefix: string
  subtitle: ReactNode
  title: string
}) {
  return (
    <div className="group">
      <input
        autoFocus={props.autoFocus}
        className="outline-hidden w-full border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight text-neutral-950 placeholder:font-medium placeholder:text-neutral-300 dark:text-neutral-50 dark:placeholder:text-neutral-700"
        onChange={(event) => props.onTitleChange(event.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        value={props.title}
      />
      {props.showSlugPill ? (
        <SlugPill
          copyPageUrl={props.copyPageUrl}
          displayPath={props.displayPath}
          onSlugChange={props.onSlugChange}
          slug={props.slug}
          slugPlaceholder={props.slugPlaceholder}
          slugPrefix={props.slugPrefix}
        />
      ) : null}
      {props.subtitle}
    </div>
  )
}

function SlugPill(props: {
  copyPageUrl?: () => void
  displayPath: string
  onSlugChange: (value: string) => void
  slug: string
  slugPlaceholder: string
  slugPrefix: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const hasSlug = Boolean(props.slug.trim())
  const triggerLabel = hasSlug
    ? props.displayPath
    : t('write.editor.titleArea.addSlug')

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        aria-label={
          hasSlug
            ? t('write.editor.titleArea.editSlugAria')
            : t('write.editor.titleArea.addSlugAria')
        }
        className={cn(
          '-ml-1 mt-1 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-xs text-fg-muted transition-opacity duration-150 hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15',
        )}
        type="button"
      >
        <span className="truncate">{triggerLabel}</span>
        <Pencil aria-hidden="true" className="size-3 shrink-0" />
      </Popover.Trigger>
      <Popover.Content className="p-3" width="md">
        <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Slug
        </div>
        <div className="mt-2 flex items-center gap-1 rounded-sm border border-border bg-surface-inset px-2 py-1.5 font-mono text-xs">
          {props.slugPrefix ? (
            <span className="select-none text-fg-subtle">
              {props.slugPrefix}
            </span>
          ) : null}
          <input
            autoFocus
            className="outline-hidden min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-subtle"
            onChange={(event) => props.onSlugChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                setOpen(false)
              }
            }}
            placeholder={props.slugPlaceholder}
            value={props.slug}
          />
        </div>
        {props.copyPageUrl ? (
          <div className="mt-2 flex justify-end">
            <button
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:pointer-events-none disabled:opacity-40"
              disabled={!hasSlug}
              onClick={props.copyPageUrl}
              type="button"
            >
              <Copy aria-hidden="true" className="size-3" />
              {t('write.editor.copyLink')}
            </button>
          </div>
        ) : null}
      </Popover.Content>
    </Popover>
  )
}

function PostFields(props: {
  categories: CategoryEntity[]
  currentPostId: string
  relatedPosts: PostModel[]
  state: WriteFormState
  tags: Array<{ count: number; name: string }>
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
}) {
  const { t } = useI18n()
  const selectedTags = splitCommaList(props.state.tags)
  const selectedRelatedIds = splitCommaList(props.state.relatedId)
  const visibleRelatedPosts = props.relatedPosts.filter(
    (post) => post.id !== props.currentPostId,
  )
  const toggleTag = (tag: string) => {
    props.updateField('tags', toggleListValue(selectedTags, tag).join(', '))
  }
  const toggleRelatedPost = (postId: string) => {
    props.updateField(
      'relatedId',
      toggleListValue(selectedRelatedIds, postId).join(', '),
    )
  }

  return (
    <>
      <PanelBlock title={t('write.postFields.section.category')}>
        <Field label={t('write.postFields.category')} required>
          <SelectField
            aria-label={t('write.postFields.category')}
            onValueChange={(categoryId) =>
              props.updateField('categoryId', categoryId)
            }
            options={props.categories.map((category) => ({
              label: category.name,
              value: category.id,
            }))}
            value={props.state.categoryId}
          />
        </Field>
      </PanelBlock>

      <PanelBlock title={t('write.postFields.section.meta')}>
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          list="write-post-tags"
          label={t('write.postFields.allTags')}
          onChange={(value) => props.updateField('tags', value)}
          placeholder={t('write.postFields.allTagsPlaceholder')}
          value={props.state.tags}
        />
        <datalist id="write-post-tags">
          {props.tags.map((tag) => (
            <option key={tag.name} label={`${tag.name} (${tag.count})`}>
              {tag.name}
            </option>
          ))}
        </datalist>
        {props.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {props.tags.slice(0, 24).map((tag) => {
              const selected = selectedTags.includes(tag.name)

              return (
                <button
                  className={cn(
                    'rounded border px-2 py-1 text-xs transition-colors',
                    selected
                      ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900',
                  )}
                  key={tag.name}
                  onClick={() => toggleTag(tag.name)}
                  type="button"
                >
                  {tag.name}
                  <span className="text-current/60 ml-1">{tag.count}</span>
                </button>
              )
            })}
          </div>
        ) : null}
        <TextArea
          controlClassName="min-h-24 focus:border-neutral-400"
          label={t('write.postFields.summary')}
          onChange={(value) => props.updateField('summary', value)}
          value={props.state.summary}
        />
        <Switch
          checked={props.state.copyright}
          label={t('write.postFields.copyright')}
          onCheckedChange={(checked) => props.updateField('copyright', checked)}
        />
        <Switch
          checked={props.state.pin}
          label={t('write.postFields.pin')}
          onCheckedChange={(checked) => props.updateField('pin', checked)}
        />
        {props.state.pin ? (
          <TextInput
            controlClassName="h-9 focus:border-neutral-400"
            inputMode="numeric"
            label={t('write.postFields.pinOrder')}
            onChange={(value) => props.updateField('pinOrder', value)}
            value={props.state.pinOrder}
          />
        ) : null}
      </PanelBlock>

      <PanelBlock title={t('write.postFields.section.related')}>
        {visibleRelatedPosts.length > 0 ? (
          <>
            <SelectField
              aria-label={t('write.postFields.related.addAria')}
              onValueChange={(postId) => {
                if (postId && !selectedRelatedIds.includes(postId)) {
                  toggleRelatedPost(postId)
                }
              }}
              options={[
                { label: t('write.postFields.related.placeholder'), value: '' },
                ...visibleRelatedPosts
                  .filter((post) => !selectedRelatedIds.includes(post.id))
                  .map((post) => ({
                    label: post.category?.name
                      ? `${post.category.name} · ${post.title}`
                      : post.title,
                    value: post.id,
                  })),
              ]}
              value=""
            />
            {selectedRelatedIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedRelatedIds.map((id) => {
                  const post = visibleRelatedPosts.find((p) => p.id === id)
                  const label = post ? post.title : `${id.slice(0, 8)}…`
                  return (
                    <span
                      className="inline-flex max-w-full items-center gap-1 rounded-sm border border-neutral-200 bg-neutral-50 py-1 pl-2 pr-1 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                      key={id}
                    >
                      <span className="truncate">{label}</span>
                      <button
                        aria-label={t('write.postFields.related.removeAria')}
                        className="inline-flex size-4 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                        onClick={() => toggleRelatedPost(id)}
                        type="button"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('write.postFields.related.empty')}
          </p>
        )}
        <TextInput
          controlClassName="h-9 font-mono focus:border-neutral-400"
          label={t('write.postFields.related.idLabel')}
          onChange={(value) => props.updateField('relatedId', value)}
          placeholder={t('write.postFields.related.idPlaceholder')}
          value={props.state.relatedId}
        />
      </PanelBlock>
    </>
  )
}

function MetadataPill(props: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'rounded border px-2 py-1 text-xs transition-colors',
        props.active
          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900',
      )}
      onClick={props.onClick}
      type="button"
    >
      {props.children}
    </button>
  )
}

function NoteFields(props: {
  state: WriteFormState
  topics: TopicModel[]
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
}) {
  const { t } = useI18n()
  const [locationSearchOpen, setLocationSearchOpen] = useState(false)
  const updateLocation = (
    location: string,
    coordinates: NoteCoordinates | null,
  ) => {
    props.updateField('location', location)
    props.updateField(
      'coordinatesLat',
      typeof coordinates?.latitude === 'number'
        ? String(coordinates.latitude)
        : '',
    )
    props.updateField(
      'coordinatesLng',
      typeof coordinates?.longitude === 'number'
        ? String(coordinates.longitude)
        : '',
    )
  }

  return (
    <>
      <PanelBlock title={t('write.noteFields.section.note')}>
        <Field label={t('write.noteFields.topic')}>
          <SelectField
            aria-label={t('write.noteFields.topic')}
            onValueChange={(topicId) => props.updateField('topicId', topicId)}
            options={[
              { label: t('write.noteFields.topicNone'), value: '' },
              ...props.topics.map((topic) => ({
                label: topic.name,
                value: topic.id,
              })),
            ]}
            value={props.state.topicId}
          />
        </Field>
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          list="write-note-moods"
          label={t('write.noteFields.mood')}
          onChange={(value) => props.updateField('mood', value)}
          placeholder={t('write.noteFields.moodPlaceholder')}
          value={props.state.mood}
        />
        <datalist id="write-note-moods">
          {MOOD_SET.map((mood) => (
            <option key={mood.value} label={t(mood.labelKey)}>
              {mood.value}
            </option>
          ))}
        </datalist>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_SET.map((mood) => (
            <MetadataPill
              active={props.state.mood === mood.value}
              key={mood.value}
              onClick={() => props.updateField('mood', mood.value)}
            >
              {t(mood.labelKey)}
            </MetadataPill>
          ))}
        </div>
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          list="write-note-weathers"
          label={t('write.noteFields.weather')}
          onChange={(value) => props.updateField('weather', value)}
          placeholder={t('write.noteFields.weatherPlaceholder')}
          value={props.state.weather}
        />
        <datalist id="write-note-weathers">
          {WEATHER_SET.map((weather) => (
            <option key={weather.value} label={t(weather.labelKey)}>
              {weather.value}
            </option>
          ))}
        </datalist>
        <div className="flex flex-wrap gap-1.5">
          {WEATHER_SET.map((weather) => (
            <MetadataPill
              active={props.state.weather === weather.value}
              key={weather.value}
              onClick={() => props.updateField('weather', weather.value)}
            >
              {t(weather.labelKey)}
            </MetadataPill>
          ))}
        </div>
        <Switch
          checked={props.state.bookmark}
          label={t('write.noteFields.bookmark')}
          onCheckedChange={(checked) => props.updateField('bookmark', checked)}
        />
      </PanelBlock>

      <PanelBlock title={t('write.noteFields.section.publicLocation')}>
        <DateTimePicker
          controlClassName="h-9 focus:border-neutral-400"
          label={t('write.field.publicAt')}
          min={toDatetimeLocalValue(new Date())}
          onChange={(value) => props.updateField('publicAt', value)}
          placeholder={t('write.field.publicAtPlaceholder')}
          value={props.state.publicAt}
        />
        <div className="grid grid-cols-2 gap-1.5">
          {[
            [t('write.field.publicAtPreset.day'), { days: 1 }],
            [t('write.field.publicAtPreset.week'), { days: 7 }],
            [t('write.field.publicAtPreset.fortnight'), { days: 14 }],
            [t('write.field.publicAtPreset.month'), { months: 1 }],
          ].map(([label, offset]) => (
            <button
              className="h-8 rounded border border-neutral-200 bg-white px-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
              key={label as string}
              onClick={() =>
                props.updateField(
                  'publicAt',
                  toDatetimeLocalValue(
                    addDateOffset(new Date(), offset as DateOffset),
                  ),
                )
              }
              type="button"
            >
              {label as string}
            </button>
          ))}
        </div>
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          label={t('write.location.field.label')}
          onChange={(value) => props.updateField('location', value)}
          value={props.state.location}
        />
        <div className="flex flex-wrap gap-2">
          <GetCurrentLocationButton onChange={updateLocation} />
          <Button
            onClick={() => setLocationSearchOpen(true)}
            type="button"
            variant="subtle"
          >
            <Search aria-hidden="true" className="size-4" />
            {t('write.location.button.custom')}
          </Button>
          <Button
            disabled={
              !props.state.location &&
              !props.state.coordinatesLat &&
              !props.state.coordinatesLng
            }
            onClick={() => updateLocation('', null)}
            type="button"
            variant="subtle"
          >
            {t('write.location.button.clear')}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            controlClassName="h-9 focus:border-neutral-400"
            inputMode="decimal"
            label={t('write.location.coordinates.lat')}
            onChange={(value) => props.updateField('coordinatesLat', value)}
            value={props.state.coordinatesLat}
          />
          <TextInput
            controlClassName="h-9 focus:border-neutral-400"
            inputMode="decimal"
            label={t('write.location.coordinates.lng')}
            onChange={(value) => props.updateField('coordinatesLng', value)}
            value={props.state.coordinatesLng}
          />
        </div>
        <LocationSearchDialog
          onClose={() => setLocationSearchOpen(false)}
          onSelect={(location, coordinates) => {
            updateLocation(location, coordinates)
            setLocationSearchOpen(false)
          }}
          open={locationSearchOpen}
          placeholder={props.state.location}
        />
      </PanelBlock>

      <PanelBlock title={t('write.noteFields.section.access')}>
        <Switch
          checked={props.state.passwordProtected}
          label={t('write.field.passwordProtected')}
          onCheckedChange={(checked) =>
            props.updateField('passwordProtected', checked)
          }
        />
        {props.state.passwordProtected ? (
          <TextInput
            autoComplete="new-password"
            controlClassName="h-9 focus:border-neutral-400"
            label={t('write.field.password')}
            onChange={(value) => props.updateField('password', value)}
            placeholder={t('write.field.passwordPlaceholder')}
            type="password"
            value={props.state.password}
          />
        ) : null}
      </PanelBlock>
    </>
  )
}

function GetCurrentLocationButton(props: {
  onChange: (location: string, coordinates: NoteCoordinates) => void
}) {
  const { t } = useI18n()
  const mutation = useMutation({
    mutationFn: async () => {
      if (!navigator.geolocation) {
        throw new Error(t('write.location.error.unsupported'))
      }

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject)
        },
      )
      const { latitude, longitude } = position.coords
      const result = await callBuiltInFunction<Amap>('geocode_location', {
        latitude,
        longitude,
      })

      return {
        coordinates: { latitude, longitude },
        location: result.regeocode.formattedAddress,
      }
    },
    onError(error) {
      const geolocationErrorCode = isRecord(error) ? error.code : undefined
      if (geolocationErrorCode === 2) {
        toast.error(t('write.location.error.timeout'))
        return
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t('write.location.error.permission'),
      )
    },
    onSuccess(result) {
      props.onChange(result.location, result.coordinates)
    },
  })

  return (
    <Button
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      type="button"
      variant="subtle"
    >
      {mutation.isPending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <MapPin aria-hidden="true" className="size-4" />
      )}
      {t('write.location.button.locate')}
    </Button>
  )
}

function LocationSearchDialog(props: {
  onClose: () => void
  onSelect: (location: string, coordinates: NoteCoordinates) => void
  open: boolean
  placeholder?: string
}) {
  const { t } = useI18n()
  const [keyword, setKeyword] = useState('')
  const [options, setOptions] = useState<
    Array<{ coordinates: NoteCoordinates; id: string; label: string }>
  >([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!props.open) {
      setKeyword('')
      setOptions([])
      return
    }

    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      setOptions([])
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setLoading(true)
      callBuiltInFunction<AMapSearch>('geocode_search', {
        keywords: trimmedKeyword,
      })
        .then((result) => {
          if (cancelled) return
          setOptions(
            result.pois
              .map((poi) => {
                const [longitude, latitude] = poi.location
                  .split(',')
                  .map(Number)
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                  return null
                }

                return {
                  coordinates: { latitude, longitude },
                  id: poi.id,
                  label: [poi.cityname, poi.adname, poi.address, poi.name]
                    .filter(Boolean)
                    .join(''),
                }
              })
              .filter(
                (
                  option,
                ): option is {
                  coordinates: NoteCoordinates
                  id: string
                  label: string
                } => Boolean(option),
              ),
          )
        })
        .catch((error: unknown) => {
          if (cancelled) return
          toast.error(
            error instanceof Error
              ? error.message
              : t('write.location.error.search'),
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [keyword, props.open])

  return (
    <Modal
      className="w-[min(92vw,30rem)]"
      onClose={props.onClose}
      open={props.open}
    >
      <ModalHeader icon={Search} title={t('write.location.dialog.title')} />

      <div className="grid gap-3 p-4">
        <TextInput
          autoFocus
          controlClassName="h-9 focus:border-neutral-400"
          label={t('write.location.dialog.searchLabel')}
          onChange={setKeyword}
          placeholder={
            props.placeholder || t('write.location.dialog.placeholder')
          }
          value={keyword}
        />
        <Scroll className="max-h-72" viewportClassName="max-h-72">
          <div className="grid gap-1 pr-1">
            {loading ? (
              <div className="flex h-24 items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t('write.location.dialog.searching')}
              </div>
            ) : options.length > 0 ? (
              options.map((option) => (
                <button
                  className="grid gap-1 rounded px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  key={option.id}
                  onClick={() =>
                    props.onSelect(option.label, option.coordinates)
                  }
                  type="button"
                >
                  <span className="text-sm text-neutral-900 dark:text-neutral-100">
                    {option.label}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {option.coordinates.longitude.toFixed(6)},{' '}
                    {option.coordinates.latitude.toFixed(6)}
                  </span>
                </button>
              ))
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
                {keyword.trim()
                  ? t('write.location.dialog.searchEmpty')
                  : t('write.location.dialog.searchHint')}
              </div>
            )}
          </div>
        </Scroll>
      </div>
    </Modal>
  )
}

function PageFields(props: {
  state: WriteFormState
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
}) {
  const { t } = useI18n()
  return (
    <PanelBlock
      description={t('write.page.section.options.description')}
      icon={FileText}
      title={t('write.page.section.options.title')}
    >
      <TextInput
        controlClassName="h-9 focus:border-neutral-400"
        inputMode="numeric"
        label={t('write.pageFields.orderLabel')}
        min="0"
        onChange={(value) => props.updateField('order', value)}
        placeholder={t('write.pageFields.orderPlaceholder')}
        type="number"
        value={props.state.order}
      />
      <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {t('write.pageFields.orderHint')}
      </p>
    </PanelBlock>
  )
}

function MediaAndMetaFields(props: {
  kind: WriteKind
  state: WriteFormState
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
}) {
  const { t } = useI18n()
  const images = buildWriteImages(props.state)
  const cover = getMetaString(props.state.meta, 'cover')

  return (
    <>
      <PanelBlock
        description={t('write.section.image.description')}
        icon={ImageIcon}
        title={t('write.section.image.title')}
      >
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          label={t('write.section.image.coverLabel')}
          list="page-cover-image-options"
          onChange={(value) =>
            props.updateField(
              'meta',
              setMetaValue(props.state.meta, 'cover', value),
            )
          }
          placeholder={t('write.section.image.coverPlaceholder')}
          value={cover}
        />
        {images.length > 0 ? (
          <datalist id="page-cover-image-options">
            {images.map((image) => (
              <option key={image.src} value={image.src} />
            ))}
          </datalist>
        ) : null}
        {cover ? (
          <div className="overflow-hidden border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
            <img
              alt={t('write.section.image.coverAlt')}
              className="max-h-48 w-full object-contain"
              src={cover}
            />
          </div>
        ) : null}
        {images.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('write.section.image.imageCount', { count: images.length })}
            </div>
            <div className="grid gap-1.5">
              {images.slice(0, 6).map((image) => (
                <div
                  className="truncate border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300"
                  key={image.src}
                  title={image.src}
                >
                  {image.src}
                </div>
              ))}
              {images.length > 6 ? (
                <div className="text-xs text-neutral-400 dark:text-neutral-500">
                  {t('write.section.image.moreCount', {
                    count: images.length - 6,
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('write.section.image.candidateHint')}
          </p>
        )}
      </PanelBlock>

      {props.kind === 'post' && (
        <PanelBlock icon={Sparkles} title={t('write.section.skill.title')}>
          <SkillPicker
            onChange={(next) => {
              const meta = { ...props.state.meta }
              if (next.length === 0) {
                delete meta.skillIds
                props.updateField('meta', meta)
              } else {
                props.updateField('meta', { ...meta, skillIds: next })
              }
            }}
            value={
              Array.isArray(props.state.meta?.skillIds) &&
              (props.state.meta.skillIds as unknown[]).every(
                (v) => typeof v === 'string',
              )
                ? (props.state.meta.skillIds as string[])
                : []
            }
          />
        </PanelBlock>
      )}

      <PanelBlock icon={Braces} title={t('write.section.image.metaTitle')}>
        {props.kind === 'page' ? (
          <MetaJsonField state={props.state} updateField={props.updateField} />
        ) : (
          <MetaPresetSection
            meta={props.state.meta}
            onUpdateMeta={(meta) => props.updateField('meta', meta)}
            scope={props.kind === 'post' ? 'post' : 'note'}
          />
        )}
      </PanelBlock>
    </>
  )
}

function MetaJsonField(props: {
  state: WriteFormState
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState(() => formatMetaJson(props.state.meta))
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(formatMetaJson(props.state.meta))
    setError('')
  }, [props.state.meta])

  const apply = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('')
      props.updateField('meta', {})
      return
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (!isRecord(parsed)) {
        setError(t('write.meta.json.invalidObject'))
        return
      }
      setError('')
      props.updateField('meta', parsed)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t('write.meta.json.parseError'),
      )
    }
  }

  return (
    <div className="space-y-2">
      <TextArea
        controlClassName="min-h-32 font-mono text-xs leading-5 focus:border-neutral-400"
        label="Meta JSON"
        onBlur={apply}
        onChange={setValue}
        placeholder='{"cover":"https://..."}'
        value={value}
      />
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            'min-w-0 text-xs',
            error
              ? 'text-red-600 dark:text-red-400'
              : 'text-neutral-500 dark:text-neutral-400',
          )}
        >
          {error || t('write.meta.json.emptyHint')}
        </p>
        <Button onClick={apply} type="button" variant="subtle">
          {t('write.meta.json.applyButton')}
        </Button>
      </div>
    </div>
  )
}

interface ParsedPageMarkdown {
  meta?: Record<string, unknown>
  order?: string
  slug?: string
  subtitle?: string
  text: string
  title?: string
}

function PageParseMarkdownDialog(props: {
  onApply: (parsed: ParsedPageMarkdown) => void
  onClose: () => void
  open: boolean
}) {
  const { t } = useI18n()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!props.open) {
      setValue('')
    }
  }, [props.open])

  const apply = () => {
    const parsed = parsePageMarkdown(value)

    if (!parsed.text.trim() && !parsed.title?.trim()) {
      toast.error(t('write.parseMd.invalid'))
      return
    }

    props.onApply(parsed)
  }

  return (
    <Modal
      onClose={props.onClose}
      open={props.open}
      popupStyle={{ height: 'min(82vh, 42rem)', width: 'min(92vw, 56rem)' }}
    >
      <ModalHeader title={t('write.parseMd.dialogTitle')} />
      <div className="min-h-0 flex-1 p-4">
        <TextArea
          controlClassName="h-full min-h-0 resize-none rounded border-neutral-200 font-mono text-xs leading-5 focus:border-neutral-400 dark:border-neutral-800"
          onChange={setValue}
          placeholder={t('write.parseMd.placeholder')}
          value={value}
        />
      </div>
      <ModalFooter>
        <p className="mr-auto min-w-0 text-xs text-fg-muted">
          {t('write.parseMd.hint')}
        </p>
        <Button onClick={() => setValue('')} type="button" variant="subtle">
          {t('write.parseMd.reset')}
        </Button>
        <Button onClick={apply} type="button">
          {t('write.parseMd.ok')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function PageLexicalDebugDialog(props: {
  content: string
  onClose: () => void
  open: boolean
}) {
  const { t } = useI18n()
  const formattedContent = useMemo(
    () => formatLexicalDebugContent(props.content),
    [props.content],
  )

  const copyContent = () => {
    void navigator.clipboard
      .writeText(formattedContent)
      .then(() => toast.success(t('write.section.lexicalDebug.copyOk')))
      .catch(() => toast.error(t('write.toast.copyFailed')))
  }

  return (
    <Drawer
      footer={
        <>
          <p className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {t('write.section.lexicalDebug.footer')}
          </p>
          <Button onClick={copyContent} type="button" variant="subtle">
            {t('write.section.lexicalDebug.copyButton')}
          </Button>
        </>
      }
      icon={Bug}
      onClose={props.onClose}
      open={props.open}
      title="Lexical State"
      widthClassName="w-[min(92vw,38rem)]"
    >
      <Scroll className="min-h-0 flex-1" innerClassName="p-4">
        <pre className="min-h-full whitespace-pre-wrap break-words border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-5 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200">
          {formattedContent}
        </pre>
      </Scroll>
    </Drawer>
  )
}

function formatLexicalDebugContent(content: string) {
  if (!content.trim()) return '{}'

  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

function parsePageMarkdown(value: string): ParsedPageMarkdown {
  let text = value.trim()
  const parsed: ParsedPageMarkdown = { text: '' }
  const yamlHeader = /^---\r?\n(.*?)\r?\n---/s.exec(text)

  if (yamlHeader) {
    const meta = parseYamlMeta(yamlHeader[1])
    const { order, slug, subtitle, title, ...restMeta } = meta

    parsed.title = optionalString(title)
    parsed.slug = optionalString(slug)
    parsed.subtitle = optionalString(subtitle)
    if (order != null) {
      parsed.order = String(order)
    }
    if (Object.keys(restMeta).length > 0) {
      parsed.meta = restMeta
    }
    text = text.replace(yamlHeader[0], '').trim()
  }

  const lines = text.split('\n')
  const firstLine = lines[0]?.trim() ?? ''
  if (firstLine.startsWith('#')) {
    const headingTitle = firstLine.replace(/^#+/, '').trim()

    if (headingTitle) {
      parsed.title = headingTitle
      lines.shift()
    }
  }

  parsed.text = lines.join('\n').trim()
  return parsed
}

function parseYamlMeta(value: string): Record<string, unknown> {
  try {
    const meta = load(value)

    return meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {}
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : translate('write.parseMd.yamlParseFailed')

    toast.error(message)
    return {}
  }
}

function optionalString(value: unknown) {
  if (value == null) return undefined

  return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getMetaString(meta: Record<string, unknown>, key: string) {
  const value = meta[key]
  return typeof value === 'string' ? value : ''
}

function setMetaValue(
  meta: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  const next = { ...meta }

  if (value == null || value === '') {
    delete next[key]
  } else {
    next[key] = value
  }

  return next
}

function formatMetaJson(meta: Record<string, unknown>) {
  return Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : ''
}

function buildWriteImages(state: WriteFormState): ImageModel[] {
  const images = new Map<string, ImageModel>()
  const addImage = (image: ImageModel | null | undefined) => {
    if (!image?.src) return
    images.set(image.src, image)
  }
  const addImageSrc = (src: string | undefined) => {
    if (!src || images.has(src)) return
    images.set(src, {
      accent: '',
      height: 0,
      src,
      type: getFileExtension(src),
      width: 0,
    })
  }

  for (const image of state.images) addImage(image)
  for (const src of pickImagesFromMarkdown(state.text)) addImageSrc(src)
  addImageSrc(getMetaString(state.meta, 'cover'))

  return [...images.values()]
}

function pickImagesFromMarkdown(text: string) {
  const images: string[] = []
  // eslint-disable-next-line unicorn/better-regex -- `[^\]]` form preserved; `[^]]` changes parse semantics
  const imagePattern = /!\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g

  for (const match of text.matchAll(imagePattern)) {
    if (match[1]) images.push(match[1])
  }

  return images
}

function getFileExtension(src: string) {
  const pathname = src.split(/[#?]/)[0] ?? src
  return pathname.split('.').pop() || ''
}

function applyParsedPageMarkdown(
  state: WriteFormState,
  parsed: ParsedPageMarkdown,
): WriteFormState {
  return {
    ...state,
    meta: parsed.meta ?? state.meta,
    order: parsed.order ?? state.order,
    slug: parsed.slug ?? state.slug,
    subtitle: parsed.subtitle ?? state.subtitle,
    text: parsed.text,
    title: parsed.title ?? state.title,
  }
}

function PageSettingsPanel(props: {
  state: WriteFormState
  updateField: <TKey extends keyof WriteFormState>(
    key: TKey,
    value: WriteFormState[TKey],
  ) => void
}) {
  return (
    <AsidePanel>
      <Scroll
        className="min-h-0 flex-1"
        innerClassName="grid grid-cols-[minmax(0,1fr)] gap-5 px-5 py-4"
      >
        <PageFields state={props.state} updateField={props.updateField} />
        <MediaAndMetaFields
          kind="page"
          state={props.state}
          updateField={props.updateField}
        />
      </Scroll>
    </AsidePanel>
  )
}

function PanelBlock(props: {
  children: ReactNode
  description?: string
  icon?: LucideIcon
  title: string
}) {
  const Icon = props.icon

  return (
    <section className="border-b border-neutral-200 pb-5 last:border-b-0 dark:border-neutral-800">
      <div className="mb-3 grid gap-1">
        <h3 className="inline-flex items-center gap-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
          {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
          <span>{props.title}</span>
        </h3>
        {props.description ? (
          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {props.description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">{props.children}</div>
    </section>
  )
}

function Field(props: {
  children: ReactNode
  label: string
  required?: boolean
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {props.label}
        {props.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {props.children}
    </label>
  )
}

function WriteSkeleton(props: { kind: WriteKind }) {
  if (props.kind === 'page') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="mx-auto w-full max-w-[60rem] shrink-0 px-3 pb-2 pt-6">
          <div className="h-14 w-full animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
        <div className="mx-auto mt-6 h-[34rem] w-full max-w-[60rem] px-3">
          <div className="h-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="h-11 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        <div className="h-[34rem] animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-28 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
            key={index}
          />
        ))}
      </div>
    </div>
  )
}

type WriteModel = NoteModel | PageModel | PostModel

const draftRefTypeByKind: Record<WriteKind, DraftRefType> = {
  note: DraftRefType.Note,
  page: DraftRefType.Page,
  post: DraftRefType.Post,
}

function getPublishedContent(model: WriteModel): PublishedWriteContent {
  return {
    content: model.content ?? undefined,
    contentFormat: model.contentFormat,
    text: model.text ?? '',
    title: model.title,
    updatedAt: model.modifiedAt || model.createdAt,
  }
}

function isDraftNewerThanPublished(draft: DraftModel, model: WriteModel) {
  const draftUpdatedAt = Date.parse(draft.updatedAt)
  const publishedUpdatedAt = Date.parse(model.modifiedAt || model.createdAt)

  if (Number.isNaN(draftUpdatedAt) || Number.isNaN(publishedUpdatedAt)) {
    return true
  }

  return draftUpdatedAt > publishedUpdatedAt
}

function fromModel(kind: WriteKind, model: WriteModel) {
  if (kind === 'post') {
    const post = model as PostModel
    return {
      ...emptyState,
      categoryId: post.categoryId,
      content: post.content ?? '',
      contentFormat: post.contentFormat ?? 'markdown',
      copyright: post.copyright,
      images: post.images ?? [],
      isPublished: post.isPublished ?? true,
      meta: isRecord(post.meta) ? post.meta : {},
      pin: Boolean(post.pinAt),
      pinOrder: String(post.pinOrder ?? 1),
      relatedId: post.related?.map((item) => item.id).join(', ') ?? '',
      slug: post.slug,
      summary: post.summary ?? '',
      tags: post.tags.join(', '),
      text: post.text ?? '',
      title: post.title,
    }
  }

  if (kind === 'note') {
    const note = model as NoteModel
    return {
      ...emptyState,
      content: note.content ?? '',
      contentFormat: note.contentFormat ?? 'markdown',
      bookmark: note.bookmark,
      coordinatesLat:
        typeof note.coordinates?.latitude === 'number'
          ? String(note.coordinates.latitude)
          : '',
      coordinatesLng:
        typeof note.coordinates?.longitude === 'number'
          ? String(note.coordinates.longitude)
          : '',
      isPublished: note.isPublished,
      images: note.images ?? [],
      location: note.location ?? '',
      meta: isRecord(note.meta) ? note.meta : {},
      mood: note.mood ?? '',
      password: '',
      passwordProtected: Boolean(note.hasPassword || note.password),
      publicAt: toDatetimeLocalValue(note.publicAt),
      slug: note.slug ?? '',
      text: note.text ?? '',
      title: note.title,
      topicId: note.topicId ?? '',
      weather: note.weather ?? '',
    }
  }

  const page = model as PageModel
  return {
    ...emptyState,
    content: page.content ?? '',
    contentFormat: page.contentFormat ?? 'markdown',
    images: page.images ?? [],
    isPublished: true,
    meta: isRecord(page.meta) ? page.meta : {},
    order: typeof page.order === 'number' ? String(page.order) : '',
    slug: page.slug,
    subtitle: page.subtitle ?? '',
    text: page.text ?? '',
    title: page.title,
  }
}

function fromDraft(
  kind: WriteKind,
  draft: DraftModel,
  previous: WriteFormState,
): WriteFormState {
  const specific = draft.typeSpecificData ?? {}
  const base = {
    ...previous,
    content: draft.content ?? '',
    contentFormat: draft.contentFormat ?? 'markdown',
    images: draft.images ?? previous.images,
    meta: isRecord(draft.meta) ? draft.meta : previous.meta,
    text: draft.text ?? '',
    title: draft.title ?? '',
  }

  if (kind === 'post') {
    return {
      ...base,
      categoryId:
        typeof specific.categoryId === 'string'
          ? specific.categoryId
          : previous.categoryId,
      copyright:
        typeof specific.copyright === 'boolean'
          ? specific.copyright
          : previous.copyright,
      isPublished:
        typeof specific.isPublished === 'boolean'
          ? specific.isPublished
          : previous.isPublished,
      pin: 'pin' in specific ? Boolean(specific.pin) : previous.pin,
      pinOrder:
        typeof specific.pinOrder === 'number'
          ? String(specific.pinOrder)
          : previous.pinOrder,
      relatedId: Array.isArray(specific.relatedId)
        ? specific.relatedId.map((id) => String(id)).join(', ')
        : previous.relatedId,
      slug: typeof specific.slug === 'string' ? specific.slug : previous.slug,
      summary:
        'summary' in specific
          ? typeof specific.summary === 'string'
            ? specific.summary
            : ''
          : previous.summary,
      tags: Array.isArray(specific.tags)
        ? specific.tags.map((tag) => String(tag)).join(', ')
        : previous.tags,
    }
  }

  if (kind === 'note') {
    return {
      ...base,
      bookmark:
        typeof specific.bookmark === 'boolean'
          ? specific.bookmark
          : previous.bookmark,
      coordinatesLat:
        'coordinates' in specific && specific.coordinates == null
          ? ''
          : typeof specific.coordinates?.latitude === 'number'
            ? String(specific.coordinates.latitude)
            : previous.coordinatesLat,
      coordinatesLng:
        'coordinates' in specific && specific.coordinates == null
          ? ''
          : typeof specific.coordinates?.longitude === 'number'
            ? String(specific.coordinates.longitude)
            : previous.coordinatesLng,
      isPublished:
        typeof specific.isPublished === 'boolean'
          ? specific.isPublished
          : previous.isPublished,
      location:
        typeof specific.location === 'string'
          ? specific.location
          : previous.location,
      mood: typeof specific.mood === 'string' ? specific.mood : previous.mood,
      password:
        typeof specific.password === 'string'
          ? specific.password
          : 'password' in specific
            ? ''
            : previous.password,
      passwordProtected: resolveDraftPasswordProtected(specific, previous),
      publicAt:
        'publicAt' in specific && specific.publicAt == null
          ? ''
          : typeof specific.publicAt === 'string'
            ? toDatetimeLocalValue(specific.publicAt)
            : previous.publicAt,
      slug: typeof specific.slug === 'string' ? specific.slug : previous.slug,
      topicId:
        'topicId' in specific
          ? typeof specific.topicId === 'string'
            ? specific.topicId
            : ''
          : previous.topicId,
      weather:
        typeof specific.weather === 'string'
          ? specific.weather
          : previous.weather,
    }
  }

  return {
    ...base,
    order:
      typeof specific.order === 'number'
        ? String(specific.order)
        : previous.order,
    slug: typeof specific.slug === 'string' ? specific.slug : previous.slug,
    subtitle:
      'subtitle' in specific
        ? typeof specific.subtitle === 'string'
          ? specific.subtitle
          : ''
        : previous.subtitle,
  }
}

function resolveDraftPasswordProtected(
  specific: Record<string, any>,
  previous: WriteFormState,
) {
  if (typeof specific.passwordProtected === 'boolean') {
    return specific.passwordProtected
  }

  if (!('password' in specific)) {
    return previous.passwordProtected
  }

  if (typeof specific.password === 'string') {
    return specific.password.length > 0 || previous.passwordProtected
  }

  return previous.passwordProtected
}

function buildPostWriteData(
  state: WriteFormState,
  draftId?: string,
): CreatePostData {
  const projected = projectWriteState(state)
  return {
    categoryId: projected.categoryId,
    content:
      projected.contentFormat === 'lexical' ? projected.content : undefined,
    contentFormat: projected.contentFormat,
    copyright: projected.copyright,
    draftId,
    images:
      projected.contentFormat === 'lexical'
        ? undefined
        : buildWriteImages(projected),
    isPublished: projected.isPublished,
    meta: projected.meta,
    pin: projected.pin ? new Date().toISOString() : null,
    pinOrder: projected.pin ? Number(projected.pinOrder) || 1 : null,
    relatedId: splitCommaList(projected.relatedId),
    slug: projected.slug,
    summary: projected.summary || null,
    tags: projected.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    text: projected.text,
    title: projected.title,
  }
}

function buildNoteWriteData(
  state: WriteFormState,
  draftId?: string,
): CreateNoteData {
  const projected = projectWriteState(state)
  return {
    bookmark: projected.bookmark,
    content:
      projected.contentFormat === 'lexical' ? projected.content : undefined,
    contentFormat: projected.contentFormat,
    coordinates: parseCoordinates(projected),
    draftId,
    images:
      projected.contentFormat === 'lexical'
        ? undefined
        : buildWriteImages(projected),
    isPublished: projected.isPublished,
    location: projected.location || null,
    meta: projected.meta,
    mood: projected.mood || undefined,
    password: projected.passwordProtected
      ? projected.password.trim() || undefined
      : null,
    publicAt: normalizeFutureDatetimeIso(projected.publicAt),
    slug: projected.slug || undefined,
    text: projected.text,
    title: resolveWriteTitle('note', projected),
    topicId: projected.topicId || null,
    weather: projected.weather || undefined,
  }
}

function buildPageWriteData(
  state: WriteFormState,
  draftId?: string,
): CreatePageData {
  const projected = projectWriteState(state)
  return {
    content:
      projected.contentFormat === 'lexical' ? projected.content : undefined,
    contentFormat: projected.contentFormat,
    draftId,
    images:
      projected.contentFormat === 'lexical'
        ? undefined
        : buildWriteImages(projected),
    meta: projected.meta,
    order: projected.order ? Number(projected.order) : undefined,
    slug: projected.slug,
    subtitle: projected.subtitle,
    text: projected.text,
    title: projected.title,
  }
}

function saveWrite(
  kind: WriteKind,
  id: string,
  state: WriteFormState,
  draftId?: string,
): Promise<WriteModel> {
  if (kind === 'post') {
    return savePost(id, buildPostWriteData(state, draftId))
  }

  if (kind === 'note') {
    return saveNote(id, buildNoteWriteData(state, draftId))
  }

  return savePage(id, buildPageWriteData(state, draftId))
}

function toDraftData(
  kind: WriteKind,
  state: WriteFormState,
  refId?: string,
  options: { project?: boolean } = {},
): CreateDraftData {
  if (options.project !== false) {
    state = projectWriteState(state)
  }

  const base = {
    content: state.contentFormat === 'lexical' ? state.content : undefined,
    contentFormat: state.contentFormat,
    images:
      state.contentFormat === 'lexical' ? undefined : buildWriteImages(state),
    meta: state.meta,
    refId,
    refType: draftRefTypeByKind[kind],
    text: state.text,
    title: resolveWriteTitle(kind, state),
  } satisfies CreateDraftData

  if (kind === 'post') {
    return {
      ...base,
      typeSpecificData: {
        categoryId: state.categoryId,
        copyright: state.copyright,
        isPublished: state.isPublished,
        pin: state.pin ? new Date().toISOString() : null,
        pinOrder: state.pin ? Number(state.pinOrder) || 1 : undefined,
        relatedId: splitCommaList(state.relatedId),
        slug: state.slug,
        summary: state.summary || null,
        tags: state.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    }
  }

  if (kind === 'note') {
    return {
      ...base,
      typeSpecificData: {
        isPublished: state.isPublished,
        bookmark: state.bookmark,
        coordinates: parseCoordinates(state),
        location: state.location,
        mood: state.mood,
        password: state.passwordProtected ? state.password || '' : null,
        passwordProtected: state.passwordProtected,
        publicAt: normalizeFutureDatetimeIso(state.publicAt),
        slug: state.slug,
        topicId: state.topicId || null,
        weather: state.weather,
      },
    }
  }

  return {
    ...base,
    typeSpecificData: {
      order: state.order ? Number(state.order) : undefined,
      slug: state.slug,
      subtitle: state.subtitle || null,
    },
  }
}

// Pending AI diff decorators (agent-diff) are transient review UI and must
// never be persisted — project them back to their factual (original) side.
function stripPendingAgentDiffs(content: string): string {
  if (!content.includes('"agent-diff"')) return content
  try {
    const editorState = JSON.parse(content) as SerializedEditorState
    return JSON.stringify(projectAgentDiffNodesToFactualState(editorState))
  } catch {
    return content
  }
}

function projectWriteState(state: WriteFormState): WriteFormState {
  if (state.contentFormat !== 'lexical') return state
  if (!state.content.trim()) return state
  const content = stripPendingAgentDiffs(state.content)
  return {
    ...state,
    content,
    text: mxLexicalToMarkdown(content),
  }
}

function RichWriteSurface(props: {
  agentVisible?: boolean
  autoFocus?: boolean
  content: string
  contentClassName?: string
  kind: WriteKind
  onContentChange: (content: string) => void
  onTextChange: (text: string) => void
  getMetaFields?: () => Record<string, unknown>
  metaFieldsSchema?: MetaFieldsSchema
  onMetaFieldsUpdate?: (
    updates: Record<string, unknown>,
  ) => Promise<void> | void
  onPinSelection?: () => void
  refId?: string
  surfaceClassName?: string
  surfaceStyle?: CSSProperties
}) {
  const { t } = useI18n()
  const editorRef = useRef<RichEditorWithAgentRef | null>(null)
  const dynamicCatalogMessages = useDynamicCatalogSystemMessages()
  const agent = useWriteAgent({
    agentVisible: Boolean(props.agentVisible),
    documentId: props.refId,
    documentKind: props.kind,
  })
  const latestCallbacks = useRef({
    onContentChange: props.onContentChange,
    onTextChange: props.onTextChange,
  })

  latestCallbacks.current = {
    onContentChange: props.onContentChange,
    onTextChange: props.onTextChange,
  }

  const editorStyle = {
    maxWidth: '100%',
    ...props.surfaceStyle,
  } satisfies Record<string, string | number>
  const editorOptions: RichEditorWithAgentProps = {
    apiUrl: API_URL,
    autoFocus: props.autoFocus ?? false,
    className: cn('min-h-136 bg-background', props.surfaceClassName),
    contentClassName: cn('min-h-120 px-4 py-3', props.contentClassName),
    debounceMs: 250,
    editorStyle,
    imageUpload: async (file) => {
      const preparedFile = await prepareImageFileForUpload(file)
      if (!preparedFile) throw new Error('Image upload canceled')

      const result = await uploadFile(preparedFile, 'image')
      return { src: result.url }
    },
    trackUpload: async (file) => {
      const result = await uploadFile(file, 'file')
      return { url: result.url }
    },
    videoUpload: async (file, opts) => {
      const result = await uploadFileWithProgress(file, {
        type: 'video',
        onProgress: (percent) => opts?.onProgress?.(percent),
      })
      return { src: result.url }
    },
    initialValue: parseSerializedEditorState(props.content),
    litexmlRegistry: createMxLitexmlRegistry,
    systemMessages: [
      ...buildMxEditorLitexmlSystemMessages(),
      ...dynamicCatalogMessages,
      ...(props.metaFieldsSchema
        ? buildMetaSystemMessages(props.metaFieldsSchema)
        : []),
    ],
    tools:
      props.metaFieldsSchema && props.getMetaFields && props.onMetaFieldsUpdate
        ? buildMetaTools({
            getFields: props.getMetaFields,
            schema: props.metaFieldsSchema,
            setFields: props.onMetaFieldsUpdate,
          })
        : undefined,
    onAgentLoopReady: agent.onAgentLoopReady,
    onChange: (value) => {
      latestCallbacks.current.onContentChange(JSON.stringify(value))
    },
    onEditorReady: agent.onEditorReady,
    onPinSelection: props.onPinSelection,
    onTextChange: (text) => {
      latestCallbacks.current.onTextChange(text)
    },
    placeholder: t('write.richEditor.placeholder'),
    provider: agent.provider,
    saveExcalidrawSnapshot,
    store: agent.store,
    theme: getColorScheme(),
    variant: props.kind === 'note' ? 'note' : 'article',
  }

  return (
    <>
      <Suspense
        fallback={<RichEditorFallback className={editorOptions.className} />}
      >
        <RichEditorWithAgent ref={editorRef} {...editorOptions} />
      </Suspense>
      <ContentLayoutSlot active={Boolean(props.agentVisible)} id="agent">
        <AgentPanel agent={agent} />
      </ContentLayoutSlot>
    </>
  )
}

function RichEditorFallback(props: { className?: string }) {
  return (
    <div
      className={cn(
        'min-h-136 bg-white px-4 py-3 dark:bg-neutral-950',
        props.className,
      )}
    >
      <div className="h-32 animate-pulse bg-neutral-100 dark:bg-neutral-900" />
    </div>
  )
}

function parseSerializedEditorState(
  content: string,
): SerializedEditorState | undefined {
  if (!content.trim()) return undefined

  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && 'root' in parsed) {
      return parsed as SerializedEditorState
    }
  } catch {
    return undefined
  }

  return undefined
}

async function saveExcalidrawSnapshot(snapshot: object, existingRef?: string) {
  const name = existingRef
    ? `${existingRef.replaceAll(/[^\w.-]/g, '-')}.json`
    : `excalidraw-${crypto.randomUUID()}.json`
  const file = new File([JSON.stringify(snapshot)], name, {
    type: 'application/json',
  })
  const result = await uploadFile(file, 'file')

  return result.url
}

function getColorScheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function formatDateTime(value: string | null | undefined) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date)
}

function validateState(
  kind: WriteKind,
  state: WriteFormState,
  categories: CategoryEntity[],
  isEditing: boolean,
) {
  if (kind !== 'note' && !state.title.trim())
    return translate('write.validation.titleRequired')
  const hasBody =
    state.contentFormat === 'lexical'
      ? state.text.trim().length > 0 || state.content.trim().length > 0
      : state.text.trim().length > 0
  if (!hasBody) return translate('write.validation.textRequired')
  if (kind !== 'note' && !state.slug.trim())
    return translate('write.validation.slugRequired')
  if (kind === 'post' && !state.categoryId) {
    return categories.length > 0
      ? translate('write.validation.selectCategory')
      : translate('write.validation.createCategoryFirst')
  }
  if (kind === 'page' && state.order && Number.isNaN(Number(state.order))) {
    return translate('write.validation.sortNumber')
  }
  if (kind === 'post' && state.pin && Number.isNaN(Number(state.pinOrder))) {
    return translate('write.validation.pinOrderNumber')
  }
  if (
    kind === 'note' &&
    state.passwordProtected &&
    !isEditing &&
    !state.password.trim()
  ) {
    return translate('write.validation.passwordRequired')
  }

  return null
}

function getWriteAgentMetaSchema(kind: WriteKind) {
  if (kind === 'post') return POST_META_SCHEMA
  if (kind === 'note') return NOTE_META_SCHEMA
  return PAGE_META_SCHEMA
}

function getWriteAgentMetaFields(kind: WriteKind, state: WriteFormState) {
  if (kind === 'post') {
    return {
      copyright: state.copyright,
      isPublished: state.isPublished,
      pin: state.pin,
      pinOrder: Number(state.pinOrder) || 0,
      slug: state.slug,
      summary: state.summary,
      tags: splitCommaList(state.tags),
      title: state.title,
    }
  }

  if (kind === 'note') {
    return {
      bookmark: state.bookmark,
      isPublished: state.isPublished,
      location: state.location,
      mood: state.mood,
      slug: state.slug,
      title: state.title,
      weather: state.weather,
    }
  }

  return {
    order: Number(state.order) || 0,
    slug: state.slug,
    subtitle: state.subtitle,
    title: state.title,
  }
}

function applyWriteAgentMetaUpdates(
  kind: WriteKind,
  state: WriteFormState,
  updates: Record<string, unknown>,
) {
  const next = { ...state }

  if ('title' in updates) next.title = String(updates.title ?? '')
  if ('slug' in updates) next.slug = String(updates.slug ?? '')

  if (kind === 'post') {
    if ('tags' in updates && Array.isArray(updates.tags)) {
      next.tags = updates.tags.map((tag) => String(tag)).join(', ')
    }
    if ('summary' in updates) next.summary = String(updates.summary ?? '')
    if ('copyright' in updates) next.copyright = Boolean(updates.copyright)
    if ('pin' in updates) {
      next.pin = Boolean(updates.pin)
      if (!next.pin) next.pinOrder = '0'
      else if (!next.pinOrder || Number(next.pinOrder) === 0)
        next.pinOrder = '1'
    }
    if ('pinOrder' in updates) {
      next.pinOrder = String(Number(updates.pinOrder ?? 0) || 0)
    }
    if ('isPublished' in updates) {
      next.isPublished = Boolean(updates.isPublished)
    }
  }

  if (kind === 'note') {
    if ('mood' in updates) next.mood = String(updates.mood ?? '')
    if ('weather' in updates) next.weather = String(updates.weather ?? '')
    if ('bookmark' in updates) next.bookmark = Boolean(updates.bookmark)
    if ('location' in updates) {
      next.location = updates.location == null ? '' : String(updates.location)
    }
    if ('isPublished' in updates) {
      next.isPublished = Boolean(updates.isPublished)
    }
  }

  if (kind === 'page') {
    if ('subtitle' in updates) next.subtitle = String(updates.subtitle ?? '')
    if ('order' in updates) {
      next.order = String(Number(updates.order ?? 0) || 0)
    }
  }

  return next
}

function resolveWriteTitle(kind: WriteKind, state: WriteFormState) {
  if (state.title.trim()) return state.title.trim()
  if (kind === 'note') return getDefaultNoteTitle()
  return state.title
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toggleListValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function parseCoordinates(state: WriteFormState) {
  if (!state.coordinatesLat.trim() || !state.coordinatesLng.trim()) return null

  const latitude = Number(state.coordinatesLat)
  const longitude = Number(state.coordinatesLng)

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null

  return { latitude, longitude }
}

function toDatetimeLocalValue(value: Date | string | null | undefined) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function normalizeFutureDatetimeIso(value: string) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null

  return date.toISOString()
}

interface DateOffset {
  days?: number
  months?: number
}

function addDateOffset(date: Date, offset: DateOffset) {
  const next = new Date(date)
  if (offset.days) next.setDate(next.getDate() + offset.days)
  if (offset.months) next.setMonth(next.getMonth() + offset.months)
  return next
}

function getDefaultNoteTitle(date = new Date()) {
  return translate('write.noteDefaultTitle', {
    year: date.getFullYear(),
    day: getDayOfYear(date),
  })
}

function buildNotePublicPath(
  state: Pick<WriteFormState, 'slug'>,
  note: NoteModel | undefined,
) {
  if (state.slug.trim()) {
    const date = note?.createdAt ? new Date(note.createdAt) : new Date()
    return `/notes/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}/${state.slug.trim()}`
  }

  return note?.nid ? `/notes/${note.nid}` : ''
}

function buildPostPublicPath(
  state: Pick<WriteFormState, 'slug'>,
  category: CategoryEntity | undefined,
) {
  if (!state.slug.trim() || !category?.slug) return ''
  return `/posts/${category.slug}/${state.slug.trim()}`
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
