WITH event_renames(old_name, new_name) AS (
	VALUES
		('GATEWAY_CONNECT', 'gateway.connect'),
		('GATEWAY_DISCONNECT', 'gateway.disconnect'),
		('VISITOR_ONLINE', 'visitor.online'),
		('VISITOR_OFFLINE', 'visitor.offline'),
		('AUTH_FAILED', 'auth.failed'),
		('COMMENT_CREATE', 'comment.create'),
		('COMMENT_DELETE', 'comment.delete'),
		('COMMENT_UPDATE', 'comment.update'),
		('POST_CREATE', 'post.create'),
		('POST_UPDATE', 'post.update'),
		('POST_DELETE', 'post.delete'),
		('NOTE_CREATE', 'note.create'),
		('NOTE_UPDATE', 'note.update'),
		('NOTE_DELETE', 'note.delete'),
		('PAGE_CREATE', 'page.create'),
		('PAGE_UPDATE', 'page.update'),
		('PAGE_DELETE', 'page.delete'),
		('TOPIC_CREATE', 'topic.create'),
		('TOPIC_UPDATE', 'topic.update'),
		('TOPIC_DELETE', 'topic.delete'),
		('CATEGORY_CREATE', 'category.create'),
		('CATEGORY_UPDATE', 'category.update'),
		('CATEGORY_DELETE', 'category.delete'),
		('SAY_CREATE', 'say.create'),
		('SAY_DELETE', 'say.delete'),
		('SAY_UPDATE', 'say.update'),
		('LINK_APPLY', 'link.apply'),
		('RECENTLY_CREATE', 'recently.create'),
		('RECENTLY_UPDATE', 'recently.update'),
		('RECENTLY_DELETE', 'recently.delete'),
		('AGGREGATE_UPDATE', 'aggregate.update'),
		('TRANSLATION_CREATE', 'translation.create'),
		('TRANSLATION_UPDATE', 'translation.update'),
		('TRANSLATION_DELETE', 'translation.delete'),
		('INSIGHTS_CREATE', 'insights.create'),
		('INSIGHTS_UPDATE', 'insights.update'),
		('INSIGHTS_DELETE', 'insights.delete'),
		('INSIGHTS_GENERATED', 'insights.generated'),
		('SUMMARY_GENERATED', 'summary.generated'),
		('CONTENT_REFRESH', 'content.refresh'),
		('IMAGE_REFRESH', 'image.refresh'),
		('IMAGE_FETCH', 'image.fetch'),
		('ADMIN_NOTIFICATION', 'admin.notification'),
		('ACTIVITY_LIKE', 'activity.like'),
		('ACTIVITY_UPDATE_PRESENCE', 'activity.update_presence'),
		('ACTIVITY_LEAVE_PRESENCE', 'activity.leave_presence'),
		('ARTICLE_READ_COUNT_UPDATE', 'article.read_count_update'),
		('AI_AGENT_MESSAGE', 'ai_agent.message'),
		('AI_AGENT_TOOL_EVENT', 'ai_agent.tool_event'),
		('AI_AGENT_CONFIRM_REQUEST', 'ai_agent.confirm_request'),
		('AI_AGENT_CONFIRM_RESULT', 'ai_agent.confirm_result'),
		('AI_AGENT_SESSION_STATE', 'ai_agent.session_state'),
		('companion.presence.changed', 'companion_presence.changed'),
		('TASK_UPDATE', 'task.update')
)
UPDATE "webhooks" AS webhook
SET "events" = (
	SELECT array_agg(COALESCE(event_renames.new_name, subscribed_event.name) ORDER BY subscribed_event.position)
	FROM unnest(webhook."events") WITH ORDINALITY AS subscribed_event(name, position)
	LEFT JOIN event_renames ON event_renames.old_name = subscribed_event.name
)
WHERE EXISTS (
	SELECT 1
	FROM unnest(webhook."events") AS subscribed_event(name)
	JOIN event_renames ON event_renames.old_name = subscribed_event.name
);
