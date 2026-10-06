use crate::protocol::PushEvent;
#[cfg(test)]
use crate::protocol::{COMMENT_CREATED_EVENT, COMMENT_REPLIED_EVENT, CONTENT_PUBLISHED_EVENT};

pub const FANOUT_DELIVERY_INSERT_SQL: &str = "INSERT INTO push_deliveries
         (id, source_id, event_id, binding_id, installation_id, next_attempt_at)
         SELECT 'dlv_' || encode(gen_random_bytes(18), 'hex'), b.source_id, $1::text,
                b.id, b.installation_id, $3::timestamptz
         FROM push_bindings b
         JOIN push_installations i ON i.id = b.installation_id
         WHERE b.source_id = $2::text AND b.revoked_at IS NULL AND i.revoked_at IS NULL
           AND i.app_id = $4::text
           AND ($5::text IS NULL OR b.reader_id = $5::text)
           AND ($6::text IS NULL OR COALESCE((b.preferences ->> ($6::text))::boolean, false) = true)";

pub const SPACE_APP_ID: &str = "space";
pub const YOHAKU_APP_ID: &str = "yohaku";

#[derive(Debug, PartialEq)]
pub struct FanoutQuery<'a> {
    pub app_id: &'static str,
    pub reader_id: Option<&'a str>,
    pub preference_key: Option<&'static str>,
}

pub fn fanout_query_for_event(event: &PushEvent) -> FanoutQuery<'_> {
    match event {
        PushEvent::CommentCreated(_) => FanoutQuery {
            app_id: SPACE_APP_ID,
            reader_id: None,
            preference_key: None,
        },
        PushEvent::ContentPublished(e) => FanoutQuery {
            app_id: YOHAKU_APP_ID,
            reader_id: None,
            preference_key: Some(match e.data.resource().0 {
                "post" => "content_post",
                "note" => "content_note",
                _ => "content_recently",
            }),
        },
        PushEvent::CommentReplied(e) => FanoutQuery {
            app_id: YOHAKU_APP_ID,
            reader_id: Some(&e.data.recipient_reader_id),
            preference_key: Some("comment_replied"),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn event(event_type: &str, subject: &str, data: serde_json::Value) -> PushEvent {
        PushEvent::parse(json!({
            "specversion": "1.0",
            "id": "e1",
            "source": "urn:mx-core:instance:src_1",
            "type": event_type,
            "subject": subject,
            "time": "2026-10-06T12:00:00.000Z",
            "datacontenttype": "application/json",
            "data": data,
        }))
        .unwrap()
    }

    #[test]
    fn routes_events_to_apps_and_preferences() {
        let created = event(
            COMMENT_CREATED_EVENT,
            "comment/c1",
            json!({ "resource_id": "c1", "resource_type": "comment" }),
        );
        assert_eq!(
            fanout_query_for_event(&created),
            FanoutQuery {
                app_id: SPACE_APP_ID,
                reader_id: None,
                preference_key: None
            }
        );

        let note = event(
            CONTENT_PUBLISHED_EVENT,
            "note/n1",
            json!({ "resource_id": "n1", "resource_type": "note", "display_title": "T", "target_path": "/notes/1" }),
        );
        assert_eq!(
            fanout_query_for_event(&note).preference_key,
            Some("content_note")
        );

        let replied = event(
            COMMENT_REPLIED_EVENT,
            "comment/c2",
            json!({
                "resource_id": "c2", "resource_type": "comment", "recipient_reader_id": "r1", "sender_id": "s",
                "sender_name": "S", "target_title": "T", "target_path": "/p"
            }),
        );
        assert_eq!(
            fanout_query_for_event(&replied),
            FanoutQuery {
                app_id: YOHAKU_APP_ID,
                reader_id: Some("r1"),
                preference_key: Some("comment_replied")
            }
        );
    }
}
