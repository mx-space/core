/** Prefix for serverless function broadcast events */
export const SERVERLESS_EVENT_PREFIX = 'fn.'

export enum BusinessEvents {
  GATEWAY_CONNECT = 'gateway.connect',
  GATEWAY_DISCONNECT = 'gateway.disconnect',

  VISITOR_ONLINE = 'visitor.online',
  VISITOR_OFFLINE = 'visitor.offline',

  AUTH_FAILED = 'auth.failed',

  COMMENT_CREATE = 'comment.create',
  COMMENT_DELETE = 'comment.delete',
  COMMENT_UPDATE = 'comment.update',

  POST_CREATE = 'post.create',
  POST_UPDATE = 'post.update',
  POST_DELETE = 'post.delete',

  NOTE_CREATE = 'note.create',
  NOTE_UPDATE = 'note.update',
  NOTE_DELETE = 'note.delete',

  PAGE_CREATE = 'page.create',
  PAGE_UPDATE = 'page.update',
  PAGE_DELETE = 'page.delete',

  TOPIC_CREATE = 'topic.create',
  TOPIC_UPDATE = 'topic.update',
  TOPIC_DELETE = 'topic.delete',

  CATEGORY_CREATE = 'category.create',
  CATEGORY_UPDATE = 'category.update',
  CATEGORY_DELETE = 'category.delete',

  SAY_CREATE = 'say.create',
  SAY_DELETE = 'say.delete',
  SAY_UPDATE = 'say.update',

  LINK_APPLY = 'link.apply',

  RECENTLY_CREATE = 'recently.create',
  RECENTLY_UPDATE = 'recently.update',
  RECENTLY_DELETE = 'recently.delete',

  AGGREGATE_UPDATE = 'aggregate.update',

  // AI Translation
  TRANSLATION_CREATE = 'translation.create',
  TRANSLATION_UPDATE = 'translation.update',
  TRANSLATION_DELETE = 'translation.delete',

  // AI Insights
  INSIGHTS_CREATE = 'insights.create',
  INSIGHTS_UPDATE = 'insights.update',
  INSIGHTS_DELETE = 'insights.delete',
  INSIGHTS_GENERATED = 'insights.generated',

  // AI Summary
  SUMMARY_GENERATED = 'summary.generated',

  // util
  CONTENT_REFRESH = 'content.refresh', // Content updated or reset; page needs reload

  // for admin
  IMAGE_REFRESH = 'image.refresh',
  IMAGE_FETCH = 'image.fetch',

  ADMIN_NOTIFICATION = 'admin.notification',

  // activity
  ACTIVITY_LIKE = 'activity.like',
  ACTIVITY_UPDATE_PRESENCE = 'activity.update_presence',
  ACTIVITY_LEAVE_PRESENCE = 'activity.leave_presence',

  ARTICLE_READ_COUNT_UPDATE = 'article.read_count_update',

  // AI Agent
  AI_AGENT_MESSAGE = 'ai_agent.message',
  AI_AGENT_TOOL_EVENT = 'ai_agent.tool_event',
  AI_AGENT_CONFIRM_REQUEST = 'ai_agent.confirm_request',
  AI_AGENT_CONFIRM_RESULT = 'ai_agent.confirm_result',
  AI_AGENT_SESSION_STATE = 'ai_agent.session_state',

  // Companion public presence projection
  COMPANION_PRESENCE_CHANGED = 'companion_presence.changed',

  // Task Queue realtime fan-out (spec 2)
  TASK_UPDATE = 'task.update',
}
export enum EventScope {
  TO_VISITOR = 1 << 0,
  TO_ADMIN = 1 << 1,
  TO_SYSTEM = 1 << 2,
  TO_VISITOR_ADMIN = (1 << 0) | (1 << 1),
  TO_SYSTEM_VISITOR = (1 << 0) | (1 << 2),
  TO_SYSTEM_ADMIN = (1 << 1) | (1 << 2),
  ALL = (1 << 0) | (1 << 1) | (1 << 2),
}
