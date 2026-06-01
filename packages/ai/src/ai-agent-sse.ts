import type { Static } from 'typebox'
import { Type } from 'typebox'

const ContentIndex = Type.Object({
  contentIndex: Type.Number(),
})

const TextStart = Type.Object({
  type: Type.Literal('text_start'),
  contentIndex: Type.Number(),
})

const TextDelta = Type.Object({
  type: Type.Literal('text_delta'),
  contentIndex: Type.Number(),
  delta: Type.String(),
})

const TextEnd = Type.Object({
  type: Type.Literal('text_end'),
  contentIndex: Type.Number(),
})

const ThinkingStart = Type.Object({
  type: Type.Literal('thinking_start'),
  contentIndex: Type.Number(),
})

const ThinkingDelta = Type.Object({
  type: Type.Literal('thinking_delta'),
  contentIndex: Type.Number(),
  delta: Type.String(),
})

const ThinkingEnd = Type.Object({
  type: Type.Literal('thinking_end'),
  contentIndex: Type.Number(),
})

const ToolcallStart = Type.Object({
  type: Type.Literal('toolcall_start'),
  contentIndex: Type.Number(),
  // Tool-call id surfaced from the upstream pi event (extracted from
  // `event.partial.content[contentIndex].id`). Optional for forward-compat with
  // pre-existing fixtures and providers that don't surface it; the admin
  // transport falls back to delaying haklex chunk emission until id is known.
  id: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
})

const ToolcallDelta = Type.Object({
  type: Type.Literal('toolcall_delta'),
  contentIndex: Type.Number(),
  partialArgs: Type.Record(Type.String(), Type.Unknown()),
})

const ToolCallPayload = Type.Object({
  id: Type.String(),
  name: Type.String(),
  arguments: Type.Record(Type.String(), Type.Unknown()),
})

const ToolcallEnd = Type.Object({
  type: Type.Literal('toolcall_end'),
  contentIndex: Type.Number(),
  toolCall: ToolCallPayload,
})

// `message` carries the full pi-ai AssistantMessage (text/thinking/toolCall
// blocks plus usage/provider/model metadata). Kept as an opaque record at the
// wire-schema layer; the consuming type below tightens it to AssistantMessage.
const DoneEvent = Type.Object({
  type: Type.Literal('done'),
  message: Type.Record(Type.String(), Type.Unknown()),
})

const ErrorEvent = Type.Object({
  type: Type.Literal('error'),
  reason: Type.Union([Type.Literal('error'), Type.Literal('aborted')]),
  message: Type.String(),
})

void ContentIndex

export const AiAgentSseEventSchema = Type.Union([
  TextStart,
  TextDelta,
  TextEnd,
  ThinkingStart,
  ThinkingDelta,
  ThinkingEnd,
  ToolcallStart,
  ToolcallDelta,
  ToolcallEnd,
  DoneEvent,
  ErrorEvent,
])

export type AiAgentSseEvent = Static<typeof AiAgentSseEventSchema>
