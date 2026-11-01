use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use p256::ecdsa::Signature;
use p256::ecdsa::signature::Signer;
use serde_json::{Map, Value, json};

use crate::config::{ApnsApp, ApnsKey};
use crate::crypto::base64url;
use crate::protocol::{
    ApnsEnvironment, ContentPublishedData, PUSH_PROTOCOL_VERSION, PushEvent, SOURCE_URN_PREFIX,
    ThinkingFactType, ThinkingVerb,
};

const TOKEN_TTL_SECONDS: i64 = 50 * 60;
const MAX_PAYLOAD_BYTES: usize = 4096;
const SHEDDABLE_FIELDS: [&str; 4] = ["cover_url", "mood", "weather", "reply_excerpt"];

#[derive(Debug)]
pub struct ApnsResult {
    pub status: u16,
    pub apns_id: Option<String>,
    pub reason: Option<String>,
}

impl ApnsResult {
    fn rejected(reason: &str) -> Self {
        Self {
            status: 400,
            apns_id: None,
            reason: Some(reason.into()),
        }
    }
}

pub struct ApnsProvider {
    apps: HashMap<String, ApnsApp>,
    client: reqwest::Client,
    tokens: Mutex<HashMap<String, (String, i64)>>,
    origin_override: Option<String>,
}

impl ApnsProvider {
    pub fn new(apps: HashMap<String, ApnsApp>) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .http2_prior_knowledge()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            apps,
            client,
            tokens: Mutex::default(),
            origin_override: std::env::var("PUSH_RELAY_APNS_ORIGIN")
                .ok()
                .filter(|origin| !origin.is_empty()),
        })
    }

    pub async fn send(
        &self,
        app_id: &str,
        environment: ApnsEnvironment,
        device_token: &str,
        event: &PushEvent,
    ) -> Result<ApnsResult, String> {
        let Some(app) = self.apps.get(app_id) else {
            return Ok(ApnsResult::rejected("UnknownApp"));
        };
        let Some(key) = app.key(environment) else {
            return Ok(ApnsResult::rejected("MissingEnvironmentKey"));
        };
        let host = match (&self.origin_override, environment) {
            (Some(origin), _) => origin.as_str(),
            (None, ApnsEnvironment::Development) => "https://api.sandbox.push.apple.com",
            (None, ApnsEnvironment::Production) => "https://api.push.apple.com",
        };
        let token = self.provider_token(app, environment, key);
        let payload = build_apns_payload(event).to_string();
        if payload.len() > MAX_PAYLOAD_BYTES {
            return Ok(ApnsResult::rejected("PayloadTooLarge"));
        }

        let response = self
            .client
            .post(format!("{host}/3/device/{device_token}"))
            .header("authorization", format!("bearer {token}"))
            .header("apns-topic", &app.bundle_id)
            .header("apns-push-type", "alert")
            .header("apns-priority", "10")
            .body(payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = response.status().as_u16();
        let apns_id = response
            .headers()
            .get("apns-id")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let body = response.text().await.map_err(|e| e.to_string())?;
        let reason = (!body.is_empty()).then(|| {
            serde_json::from_str::<Value>(&body)
                .ok()
                .and_then(|parsed| {
                    parsed
                        .get("reason")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
                .unwrap_or(body)
        });
        Ok(ApnsResult {
            status,
            apns_id,
            reason,
        })
    }

    fn provider_token(&self, app: &ApnsApp, environment: ApnsEnvironment, key: &ApnsKey) -> String {
        let now = chrono::Utc::now().timestamp();
        let cache_key = format!("{}:{}", app.id, environment.as_str());
        let mut tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((value, issued_at)) = tokens.get(&cache_key)
            && now - issued_at < TOKEN_TTL_SECONDS
        {
            return value.clone();
        }
        let header = base64url(
            json!({ "alg": "ES256", "kid": key.key_id })
                .to_string()
                .as_bytes(),
        );
        let claims = base64url(
            json!({ "iss": app.team_id, "iat": now })
                .to_string()
                .as_bytes(),
        );
        let signing_input = format!("{header}.{claims}");
        let signature: Signature = key.signing_key.sign(signing_input.as_bytes());
        let value = format!("{signing_input}.{}", base64url(&signature.to_bytes()));
        tokens.insert(cache_key, (value.clone(), now));
        value
    }
}

fn custom_fields(
    payload: &mut Map<String, Value>,
    source: &str,
    resource_type: &str,
    resource_id: &str,
) {
    payload.insert("schema_version".into(), json!(PUSH_PROTOCOL_VERSION));
    payload.insert(
        "source_id".into(),
        json!(source.replacen(SOURCE_URN_PREFIX, "", 1)),
    );
    payload.insert("resource_type".into(), json!(resource_type));
    payload.insert("resource_id".into(), json!(resource_id));
}

fn thinking_title_key(verb: ThinkingVerb) -> &'static str {
    match verb {
        ThinkingVerb::Watched => "PUSH_THINKING_WATCHED",
        ThinkingVerb::Read => "PUSH_THINKING_READ",
        ThinkingVerb::Listened => "PUSH_THINKING_LISTENED",
        ThinkingVerb::Studied => "PUSH_THINKING_STUDIED",
        ThinkingVerb::Linked => "PUSH_THINKING_LINKED",
    }
}

fn thinking_fact_type_key(fact_type: ThinkingFactType) -> &'static str {
    match fact_type {
        ThinkingFactType::Tv => "PUSH_THINKING_FACT_TV",
        ThinkingFactType::Movie => "PUSH_THINKING_FACT_MOVIE",
        ThinkingFactType::Book => "PUSH_THINKING_FACT_BOOK",
        ThinkingFactType::Album => "PUSH_THINKING_FACT_ALBUM",
        ThinkingFactType::Song => "PUSH_THINKING_FACT_SONG",
    }
}

fn add_summary(alert: &mut Map<String, Value>, body: Option<&String>) {
    if let Some(body) = body.filter(|b| !b.is_empty()) {
        alert.insert("loc-key".into(), json!("PUSH_CONTENT_SUMMARY"));
        alert.insert("loc-args".into(), json!([body]));
    }
}

fn content_alert(data: &ContentPublishedData) -> (Map<String, Value>, &'static str) {
    let mut alert = Map::new();
    match data {
        ContentPublishedData::Article(d) => {
            alert.insert("title-loc-key".into(), json!("PUSH_CONTENT_TITLE"));
            alert.insert("title-loc-args".into(), json!([d.display_title]));
            add_summary(&mut alert, d.summary.as_ref());
            (
                alert,
                if d.resource_type == "post" {
                    "posts"
                } else {
                    "notes"
                },
            )
        }
        ContentPublishedData::RecentlyEnriched(d) => {
            alert.insert("title-loc-key".into(), json!(thinking_title_key(d.verb)));
            alert.insert("title-loc-args".into(), json!([d.owner_name, d.work_title]));
            let creator = d.fact_creator.as_ref().filter(|c| !c.is_empty());
            let year = d.fact_year.as_ref().filter(|y| !y.is_empty());
            let subtitle = match (creator, year, d.fact_type) {
                (Some(creator), Some(year), _) => {
                    Some(("PUSH_THINKING_FACT_CREATOR", json!([creator, year])))
                }
                (Some(creator), None, _) => {
                    Some(("PUSH_THINKING_FACT_CREATOR_ONLY", json!([creator])))
                }
                (None, Some(year), Some(fact_type)) => {
                    Some((thinking_fact_type_key(fact_type), json!([year])))
                }
                _ => None,
            };
            if let Some((key, args)) = subtitle {
                alert.insert("subtitle-loc-key".into(), json!(key));
                alert.insert("subtitle-loc-args".into(), args);
            }
            add_summary(&mut alert, d.description.as_ref());
            (alert, "recently")
        }
        ContentPublishedData::RecentlyPlain(d) => {
            alert.insert("title-loc-key".into(), json!("PUSH_THINKING_PLAIN"));
            alert.insert("title-loc-args".into(), json!([d.owner_name, d.text]));
            add_summary(&mut alert, d.summary.as_ref());
            (alert, "recently")
        }
    }
}

pub fn build_apns_payload(event: &PushEvent) -> Value {
    let mut payload = Map::new();
    match event {
        PushEvent::CommentCreated(e) => {
            payload.insert(
                "aps".into(),
                json!({
                    "alert": { "title": "New comment", "body": "A new comment is ready to review." },
                    "sound": "default",
                    "thread-id": "comments",
                    "category": "SPACE_COMMENT",
                }),
            );
            custom_fields(
                &mut payload,
                &e.source,
                &e.data.resource_type,
                &e.data.resource_id,
            );
        }
        PushEvent::ContentPublished(e) => {
            let (alert, thread_id) = content_alert(&e.data);
            let mut aps = json!({ "alert": alert, "sound": "default", "thread-id": thread_id, "category": "YOHAKU_CONTENT" });
            if let ContentPublishedData::Article(d) = &e.data {
                aps["mutable-content"] = json!(1);
                for (key, value) in [
                    ("owner_name", &d.owner_name),
                    ("cover_url", &d.cover_url),
                    ("weather", &d.weather),
                    ("mood", &d.mood),
                ] {
                    if let Some(value) = value {
                        payload.insert(key.into(), json!(value));
                    }
                }
            }
            payload.insert("aps".into(), aps);
            payload.insert("event_type".into(), json!(e.event_type));
            payload.insert("target_path".into(), json!(e.data.target_path()));
            let (resource_type, resource_id) = e.data.resource();
            custom_fields(&mut payload, &e.source, resource_type, resource_id);
        }
        PushEvent::CommentReplied(e) => {
            let d = &e.data;
            payload.insert(
                "aps".into(),
                json!({
                    "alert": {
                        "title-loc-key": "PUSH_REPLY_TITLE",
                        "title-loc-args": [d.sender_name],
                        "loc-key": "PUSH_REPLY_BODY",
                        "loc-args": [d.target_title],
                    },
                    "sound": "default",
                    "thread-id": "comment-replies",
                    "category": "YOHAKU_COMMENT_REPLIED",
                    "mutable-content": 1,
                }),
            );
            payload.insert("event_type".into(), json!(e.event_type));
            payload.insert("sender_id".into(), json!(d.sender_id));
            payload.insert("sender_name".into(), json!(d.sender_name));
            if let Some(url) = d.sender_avatar_url.as_ref().filter(|u| !u.is_empty()) {
                payload.insert("sender_avatar_url".into(), json!(url));
            }
            payload.insert("target_title".into(), json!(d.target_title));
            payload.insert("target_path".into(), json!(d.target_path));
            if let Some(excerpt) = &d.reply_excerpt {
                payload.insert("reply_excerpt".into(), json!(excerpt));
            }
            custom_fields(&mut payload, &e.source, &d.resource_type, &d.resource_id);
        }
    }
    for field in SHEDDABLE_FIELDS {
        if Value::Object(payload.clone()).to_string().len() <= MAX_PAYLOAD_BYTES {
            break;
        }
        payload.remove(field);
    }
    Value::Object(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payloads_match_node() {
        let fixtures: Vec<Value> =
            serde_json::from_str(include_str!("../test/apns-payloads.json")).unwrap();
        assert!(!fixtures.is_empty());
        for fixture in fixtures {
            let event = PushEvent::parse(fixture["event"].clone()).unwrap();
            assert_eq!(
                build_apns_payload(&event),
                fixture["payload"],
                "event {}",
                fixture["event"]["id"]
            );
        }
    }

    fn content_event(data: Value) -> PushEvent {
        let resource_type = data["resource_type"].as_str().unwrap().to_string();
        let resource_id = data["resource_id"].as_str().unwrap().to_string();
        PushEvent::parse(json!({
            "specversion": "1.0",
            "id": "content.published:x",
            "source": "urn:mx-core:instance:src_abc",
            "type": "dev.mx-space.content.published.v1",
            "subject": format!("{resource_type}/{resource_id}"),
            "time": "2026-10-06T12:00:00.000Z",
            "datacontenttype": "application/json",
            "data": data,
        }))
        .unwrap()
    }

    fn reply_event(extra: Value) -> PushEvent {
        let mut data = json!({
            "resource_id": "c2",
            "resource_type": "comment",
            "recipient_reader_id": "rd1",
            "sender_id": "s1",
            "sender_name": "Innei",
            "target_title": "十月未央",
            "target_path": "/comments/n1",
        });
        data.as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        PushEvent::parse(json!({
            "specversion": "1.0",
            "id": "comment.replied:c2",
            "source": "urn:mx-core:instance:src_abc",
            "type": "dev.mx-space.comment.replied.v1",
            "subject": "comment/c2",
            "time": "2026-10-06T12:00:00.000Z",
            "datacontenttype": "application/json",
            "data": data,
        }))
        .unwrap()
    }

    #[test]
    fn article_banner_metadata_rides_in_custom_fields_with_unchanged_alert() {
        let payload = build_apns_payload(&content_event(json!({
            "resource_id": "n1",
            "resource_type": "note",
            "display_title": "十月未央",
            "target_path": "/notes/221",
            "owner_name": "Innei",
            "cover_url": "https://object.innei.in/c.png",
            "weather": "秋",
            "mood": "五味杂陈",
        })));
        assert_eq!(payload["aps"]["mutable-content"], json!(1));
        assert_eq!(
            payload["aps"]["alert"],
            json!({ "title-loc-key": "PUSH_CONTENT_TITLE", "title-loc-args": ["十月未央"] })
        );
        assert_eq!(payload["owner_name"], json!("Innei"));
        assert_eq!(payload["cover_url"], json!("https://object.innei.in/c.png"));
        assert_eq!(payload["weather"], json!("秋"));
        assert_eq!(payload["mood"], json!("五味杂陈"));
    }

    #[test]
    fn article_without_metadata_still_opts_into_the_extension() {
        let payload = build_apns_payload(&content_event(json!({
            "resource_id": "p1",
            "resource_type": "post",
            "display_title": "Hello",
            "target_path": "/posts/tech/hello",
        })));
        assert_eq!(payload["aps"]["mutable-content"], json!(1));
        assert!(payload.get("owner_name").is_none());
        assert!(payload.get("cover_url").is_none());
    }

    #[test]
    fn recently_does_not_opt_into_the_extension() {
        let payload = build_apns_payload(&content_event(json!({
            "resource_id": "r1",
            "resource_type": "recently",
            "target_path": "/thinking/r1",
            "kind": "plain",
            "owner_name": "Innei",
            "text": "hi",
        })));
        assert!(payload["aps"].get("mutable-content").is_none());
    }

    #[test]
    fn reply_excerpt_rides_in_custom_fields_with_unchanged_alert() {
        let payload = build_apns_payload(&reply_event(
            json!({ "reply_excerpt": "暂时还不行\u{E000}" }),
        ));
        assert_eq!(payload["reply_excerpt"], json!("暂时还不行\u{E000}"));
        assert_eq!(
            payload["aps"]["alert"],
            json!({
                "title-loc-key": "PUSH_REPLY_TITLE",
                "title-loc-args": ["Innei"],
                "loc-key": "PUSH_REPLY_BODY",
                "loc-args": ["十月未央"],
            })
        );
    }

    #[test]
    fn oversized_payload_sheds_optional_banner_fields() {
        let long_cover = format!("https://object.innei.in/{}", "a".repeat(2000));
        let payload = build_apns_payload(&content_event(json!({
            "resource_id": "p1",
            "resource_type": "post",
            "display_title": "题".repeat(160),
            "summary": "摘".repeat(360),
            "target_path": format!("/posts/{}", "b".repeat(500)),
            "owner_name": "名".repeat(80),
            "cover_url": long_cover,
            "weather": "晴",
        })));
        assert!(payload.to_string().len() <= MAX_PAYLOAD_BYTES);
        assert!(payload.get("cover_url").is_none());
        assert_eq!(payload["owner_name"], json!("名".repeat(80)));
    }
}
