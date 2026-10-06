use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use crate::validate::Issue;
use crate::validate::{Checker, decode, digits, is_https_url, is_word_or_dash, parse_iso_datetime};

pub const PUSH_PROTOCOL_VERSION: u32 = 1;
pub const COMMENT_CREATED_EVENT: &str = "dev.mx-space.comment.created.v1";
pub const CONTENT_PUBLISHED_EVENT: &str = "dev.mx-space.content.published.v1";
pub const COMMENT_REPLIED_EVENT: &str = "dev.mx-space.comment.replied.v1";
pub const SOURCE_URN_PREFIX: &str = "urn:mx-core:instance:";

#[derive(Deserialize, Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ApnsEnvironment {
    Development,
    Production,
}

impl ApnsEnvironment {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Production => "production",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "development" => Some(Self::Development),
            "production" => Some(Self::Production),
            _ => None,
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PushPreferences {
    pub content_post: bool,
    pub content_note: bool,
    pub content_recently: bool,
    pub comment_replied: bool,
}

impl Default for PushPreferences {
    fn default() -> Self {
        Self {
            content_post: true,
            content_note: true,
            content_recently: true,
            comment_replied: true,
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct Envelope<D> {
    pub specversion: String,
    pub id: String,
    pub source: String,
    pub time: String,
    pub datacontenttype: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub subject: String,
    pub data: D,
}

impl<D> Envelope<D> {
    fn map<E>(self, f: impl FnOnce(D) -> E) -> Envelope<E> {
        Envelope {
            specversion: self.specversion,
            id: self.id,
            source: self.source,
            time: self.time,
            datacontenttype: self.datacontenttype,
            event_type: self.event_type,
            subject: self.subject,
            data: f(self.data),
        }
    }

    fn check_envelope(&self, checker: &mut Checker, subject_prefixes: &[&str]) {
        checker.check(
            self.specversion == "1.0",
            &["specversion"],
            "Invalid input: expected \"1.0\"",
        );
        checker.len(&["id"], &self.id, 1, 256);
        checker.check(
            self.source.starts_with(SOURCE_URN_PREFIX),
            &["source"],
            "Invalid string: must start with \"urn:mx-core:instance:\"",
        );
        checker.check(
            parse_iso_datetime(&self.time).is_some(),
            &["time"],
            "Invalid ISO datetime",
        );
        checker.check(
            self.datacontenttype == "application/json",
            &["datacontenttype"],
            "Invalid input: expected \"application/json\"",
        );
        let subject_ok = self.subject.split_once('/').is_some_and(|(prefix, id)| {
            subject_prefixes.contains(&prefix)
                && (1..=128).contains(&id.len())
                && is_word_or_dash(id)
        });
        checker.check(
            subject_ok,
            &["subject"],
            "Invalid string: must match pattern",
        );
    }

    fn check_subject_matches(&self, checker: &mut Checker, resource_type: &str, resource_id: &str) {
        let expected = format!("{resource_type}/{resource_id}");
        if checker.issues.is_empty() && self.subject != expected {
            checker.fail(&["subject"], format!("subject must equal {expected}"));
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct CommentData {
    pub resource_id: String,
    pub resource_type: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct ArticleData {
    pub resource_id: String,
    pub resource_type: String,
    pub display_title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub target_path: String,
}

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ThinkingVerb {
    Watched,
    Read,
    Listened,
    Studied,
    Linked,
}

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ThinkingFactType {
    Tv,
    Movie,
    Book,
    Album,
    Song,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct RecentlyEnrichedData {
    pub resource_id: String,
    pub resource_type: String,
    pub target_path: String,
    pub kind: String,
    pub owner_name: String,
    pub verb: ThinkingVerb,
    pub work_title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fact_creator: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fact_year: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fact_type: Option<ThinkingFactType>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct RecentlyPlainData {
    pub resource_id: String,
    pub resource_type: String,
    pub target_path: String,
    pub kind: String,
    pub owner_name: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum ContentPublishedData {
    Article(ArticleData),
    RecentlyEnriched(RecentlyEnrichedData),
    RecentlyPlain(RecentlyPlainData),
}

impl ContentPublishedData {
    pub fn resource(&self) -> (&str, &str) {
        match self {
            Self::Article(d) => (&d.resource_type, &d.resource_id),
            Self::RecentlyEnriched(d) => (&d.resource_type, &d.resource_id),
            Self::RecentlyPlain(d) => (&d.resource_type, &d.resource_id),
        }
    }

    pub fn target_path(&self) -> &str {
        match self {
            Self::Article(d) => &d.target_path,
            Self::RecentlyEnriched(d) => &d.target_path,
            Self::RecentlyPlain(d) => &d.target_path,
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct CommentRepliedData {
    pub resource_id: String,
    pub resource_type: String,
    pub recipient_reader_id: String,
    pub sender_id: String,
    pub sender_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_avatar_url: Option<String>,
    pub target_title: String,
    pub target_path: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum PushEvent {
    CommentCreated(Envelope<CommentData>),
    ContentPublished(Envelope<ContentPublishedData>),
    CommentReplied(Envelope<CommentRepliedData>),
}

impl PushEvent {
    pub fn decode(value: Value) -> Result<Self, Vec<Issue>> {
        let Some(object) = value.as_object() else {
            return Err(vec![Issue {
                path: vec![],
                message: "Invalid input: expected object".into(),
            }]);
        };
        let event_type = object
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        match event_type.as_str() {
            COMMENT_CREATED_EVENT => decode(value).map(Self::CommentCreated),
            COMMENT_REPLIED_EVENT => decode(value).map(Self::CommentReplied),
            CONTENT_PUBLISHED_EVENT => {
                let data = object.get("data");
                let field = |name: &str| data.and_then(|d| d.get(name)).and_then(Value::as_str);
                match (field("resource_type"), field("kind")) {
                    (Some("post" | "note"), _) => decode::<Envelope<ArticleData>>(value)
                        .map(|e| e.map(ContentPublishedData::Article)),
                    (Some("recently"), Some("enriched")) => {
                        decode::<Envelope<RecentlyEnrichedData>>(value)
                            .map(|e| e.map(ContentPublishedData::RecentlyEnriched))
                    }
                    (Some("recently"), Some("plain")) => {
                        decode::<Envelope<RecentlyPlainData>>(value)
                            .map(|e| e.map(ContentPublishedData::RecentlyPlain))
                    }
                    _ => Err(vec![Issue {
                        path: vec!["data".into()],
                        message: "Invalid input".into(),
                    }]),
                }
                .map(Self::ContentPublished)
            }
            _ => Err(vec![Issue {
                path: vec!["type".into()],
                message: "Invalid discriminator value".into(),
            }]),
        }
    }

    pub fn parse(value: Value) -> Result<Self, Vec<Issue>> {
        let mut event = Self::decode(value)?;
        let mut checker = Checker::default();
        match &mut event {
            Self::CommentCreated(e) => {
                e.check_envelope(&mut checker, &["comment"]);
                checker.len(&["data", "resource_id"], &e.data.resource_id, 1, 128);
                checker.check(
                    e.data.resource_type == "comment",
                    &["data", "resource_type"],
                    "Invalid input: expected \"comment\"",
                );
            }
            Self::ContentPublished(e) => {
                e.check_envelope(&mut checker, &["post", "note", "recently"]);
                check_content_published(&mut checker, &mut e.data);
                let (resource_type, resource_id) = e.data.resource();
                let (resource_type, resource_id) =
                    (resource_type.to_string(), resource_id.to_string());
                e.check_subject_matches(&mut checker, &resource_type, &resource_id);
            }
            Self::CommentReplied(e) => {
                e.check_envelope(&mut checker, &["comment"]);
                let d = &mut e.data;
                checker.len(&["data", "resource_id"], &d.resource_id, 1, 128);
                checker.check(
                    d.resource_type == "comment",
                    &["data", "resource_type"],
                    "Invalid input: expected \"comment\"",
                );
                checker.len(
                    &["data", "recipient_reader_id"],
                    &d.recipient_reader_id,
                    1,
                    128,
                );
                checker.len(&["data", "sender_id"], &d.sender_id, 1, 128);
                checker.trimmed(&["data", "sender_name"], &mut d.sender_name, 1, 80);
                if let Some(url) = &d.sender_avatar_url {
                    checker.check(
                        is_https_url(url),
                        &["data", "sender_avatar_url"],
                        "HTTPS URL required",
                    );
                    checker.len(&["data", "sender_avatar_url"], url, 0, 2048);
                }
                checker.trimmed(&["data", "target_title"], &mut d.target_title, 1, 160);
                checker.target_path(&["data", "target_path"], &d.target_path);
                let (resource_type, resource_id) = (d.resource_type.clone(), d.resource_id.clone());
                e.check_subject_matches(&mut checker, &resource_type, &resource_id);
            }
        }
        checker.finish(event)
    }

    pub fn id(&self) -> &str {
        match self {
            Self::CommentCreated(e) => &e.id,
            Self::ContentPublished(e) => &e.id,
            Self::CommentReplied(e) => &e.id,
        }
    }

    pub fn source(&self) -> &str {
        match self {
            Self::CommentCreated(e) => &e.source,
            Self::ContentPublished(e) => &e.source,
            Self::CommentReplied(e) => &e.source,
        }
    }

    pub fn event_type(&self) -> &str {
        match self {
            Self::CommentCreated(e) => &e.event_type,
            Self::ContentPublished(e) => &e.event_type,
            Self::CommentReplied(e) => &e.event_type,
        }
    }

    pub fn subject(&self) -> &str {
        match self {
            Self::CommentCreated(e) => &e.subject,
            Self::ContentPublished(e) => &e.subject,
            Self::CommentReplied(e) => &e.subject,
        }
    }

    pub fn time(&self) -> &str {
        match self {
            Self::CommentCreated(e) => &e.time,
            Self::ContentPublished(e) => &e.time,
            Self::CommentReplied(e) => &e.time,
        }
    }
}

fn check_content_published(checker: &mut Checker, data: &mut ContentPublishedData) {
    match data {
        ContentPublishedData::Article(d) => {
            checker.len(&["data", "resource_id"], &d.resource_id, 1, 128);
            checker.trimmed(&["data", "display_title"], &mut d.display_title, 1, 160);
            checker.trimmed_opt(&["data", "summary"], &mut d.summary, 1, 360);
            checker.target_path(&["data", "target_path"], &d.target_path);
        }
        ContentPublishedData::RecentlyEnriched(d) => {
            checker.len(&["data", "resource_id"], &d.resource_id, 1, 128);
            checker.target_path(&["data", "target_path"], &d.target_path);
            checker.trimmed(&["data", "owner_name"], &mut d.owner_name, 1, 80);
            checker.trimmed(&["data", "work_title"], &mut d.work_title, 1, 160);
            checker.trimmed_opt(&["data", "description"], &mut d.description, 1, 360);
            checker.trimmed_opt(&["data", "fact_creator"], &mut d.fact_creator, 1, 80);
            if let Some(year) = &d.fact_year {
                checker.check(
                    year.len() == 4 && digits(year).is_some(),
                    &["data", "fact_year"],
                    "Invalid string: must match pattern",
                );
            }
        }
        ContentPublishedData::RecentlyPlain(d) => {
            checker.len(&["data", "resource_id"], &d.resource_id, 1, 128);
            checker.target_path(&["data", "target_path"], &d.target_path);
            checker.trimmed(&["data", "owner_name"], &mut d.owner_name, 1, 80);
            checker.trimmed(&["data", "text"], &mut d.text, 1, 160);
            checker.trimmed_opt(&["data", "summary"], &mut d.summary, 1, 360);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn comment_created() -> Value {
        json!({
            "specversion": "1.0",
            "id": "comment.created:1",
            "source": "urn:mx-core:instance:src_1",
            "type": COMMENT_CREATED_EVENT,
            "subject": "comment/abc",
            "time": "2026-10-06T12:00:00.000Z",
            "datacontenttype": "application/json",
            "data": { "resource_id": "abc", "resource_type": "comment" }
        })
    }

    #[test]
    fn parses_comment_created() {
        let event = PushEvent::parse(comment_created()).unwrap();
        assert_eq!(serde_json::to_value(&event).unwrap(), comment_created());
    }

    #[test]
    fn rejects_unknown_fields_and_bad_type() {
        let mut value = comment_created();
        value["extra"] = json!(1);
        assert!(PushEvent::parse(value).is_err());
        let mut value = comment_created();
        value["type"] = json!("nope");
        assert_eq!(
            PushEvent::parse(value).unwrap_err()[0].path,
            vec![json!("type")]
        );
    }

    #[test]
    fn trims_and_checks_content_published() {
        let value = json!({
            "specversion": "1.0",
            "id": "content:1",
            "source": "urn:mx-core:instance:src_1",
            "type": CONTENT_PUBLISHED_EVENT,
            "subject": "post/p1",
            "time": "2026-10-06T12:00:00+08:00",
            "datacontenttype": "application/json",
            "data": { "resource_id": "p1", "resource_type": "post", "display_title": "  Hi  ", "target_path": "/posts/p1" }
        });
        let PushEvent::ContentPublished(event) = PushEvent::parse(value.clone()).unwrap() else {
            panic!()
        };
        let ContentPublishedData::Article(data) = event.data else {
            panic!()
        };
        assert_eq!(data.display_title, "Hi");

        let mut mismatch = value.clone();
        mismatch["subject"] = json!("post/other");
        assert_eq!(
            PushEvent::parse(mismatch).unwrap_err()[0].message,
            "subject must equal post/p1"
        );
    }
}
