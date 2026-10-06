use chrono::{DateTime, FixedOffset, NaiveDate, NaiveTime, TimeZone, Utc};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Issue {
    pub path: Vec<Value>,
    pub message: String,
}

#[derive(Default)]
pub struct Checker {
    pub issues: Vec<Issue>,
}

pub fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

pub fn js_trim(value: &str) -> String {
    value
        .trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
        .to_string()
}

impl Checker {
    pub fn fail(&mut self, path: &[&str], message: impl Into<String>) {
        self.issues.push(Issue {
            path: path.iter().map(|segment| Value::from(*segment)).collect(),
            message: message.into(),
        });
    }

    pub fn check(&mut self, ok: bool, path: &[&str], message: &str) {
        if !ok {
            self.fail(path, message);
        }
    }

    pub fn len(&mut self, path: &[&str], value: &str, min: usize, max: usize) {
        let length = utf16_len(value);
        if length < min {
            self.fail(
                path,
                format!("Too small: expected string to have >={min} characters"),
            );
        } else if length > max {
            self.fail(
                path,
                format!("Too big: expected string to have <={max} characters"),
            );
        }
    }

    pub fn trimmed(&mut self, path: &[&str], value: &mut String, min: usize, max: usize) {
        *value = js_trim(value);
        self.len(path, value, min, max);
    }

    pub fn trimmed_opt(
        &mut self,
        path: &[&str],
        value: &mut Option<String>,
        min: usize,
        max: usize,
    ) {
        if let Some(value) = value {
            self.trimmed(path, value, min, max);
        }
    }

    pub fn target_path(&mut self, path: &[&str], value: &str) {
        self.len(path, value, 2, 512);
        self.check(
            is_internal_target_path(value),
            path,
            "target_path must be a safe internal absolute path",
        );
    }

    pub fn finish<T>(self, value: T) -> Result<T, Vec<Issue>> {
        if self.issues.is_empty() {
            Ok(value)
        } else {
            Err(self.issues)
        }
    }
}

pub fn is_word_or_dash(value: &str) -> bool {
    value
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

pub fn decode_uri_component(segment: &str) -> Option<String> {
    let bytes = segment.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = bytes.get(index + 1..index + 3)?;
            if !hex.iter().all(u8::is_ascii_hexdigit) {
                return None;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    percent_encoding::percent_decode_str(segment)
        .decode_utf8()
        .ok()
        .map(|s| s.into_owned())
}

pub fn is_safe_target_segment(segment: &str) -> bool {
    let Some(decoded) = decode_uri_component(segment) else {
        return false;
    };
    decoded != "."
        && decoded != ".."
        && !decoded
            .chars()
            .any(|c| c == '/' || c == '\\' || (c as u32) <= 0x1f || c as u32 == 0x7f)
}

pub fn is_internal_target_path(value: &str) -> bool {
    value.starts_with('/')
        && !value.starts_with("//")
        && !value.contains(['\\', '?', '#'])
        && value.split('/').all(is_safe_target_segment)
}

pub fn is_url(value: &str) -> bool {
    url::Url::parse(value).is_ok()
}

pub fn is_https_url(value: &str) -> bool {
    url::Url::parse(value).is_ok_and(|url| url.scheme() == "https")
}

pub fn digits(value: &str) -> Option<u32> {
    (!value.is_empty() && value.bytes().all(|b| b.is_ascii_digit()))
        .then(|| value.parse().ok())
        .flatten()
}

pub fn two_digit(value: &str, max: u32) -> Option<u32> {
    (value.len() == 2)
        .then(|| digits(value))
        .flatten()
        .filter(|v| *v <= max)
}

pub fn parse_iso_datetime(value: &str) -> Option<DateTime<Utc>> {
    let (date, rest) = value.split_once('T')?;
    let mut date_parts = date.split('-');
    let (year, month, day) = (date_parts.next()?, date_parts.next()?, date_parts.next()?);
    if date_parts.next().is_some() || year.len() != 4 || month.len() != 2 || day.len() != 2 {
        return None;
    }
    let date = NaiveDate::from_ymd_opt(digits(year)? as i32, digits(month)?, digits(day)?)?;

    let (clock, offset_seconds) = if let Some(clock) = rest.strip_suffix('Z') {
        (clock, 0)
    } else {
        let split = rest.len().checked_sub(6)?;
        let (clock, offset) = rest.split_at_checked(split)?;
        let sign = match offset.as_bytes()[0] {
            b'+' => 1,
            b'-' => -1,
            _ => return None,
        };
        let (hours, minutes) = offset[1..].split_once(':')?;
        (
            clock,
            sign * (two_digit(hours, 23)? * 3600 + two_digit(minutes, 59)? * 60) as i32,
        )
    };

    let (hours, rest) = clock.split_once(':')?;
    let (minutes, seconds) = rest
        .split_once(':')
        .map_or((rest, None), |(m, s)| (m, Some(s)));
    let (second, nanos) = match seconds {
        None => (0, 0),
        Some(seconds) => {
            let (whole, fraction) = seconds
                .split_once('.')
                .map_or((seconds, None), |(w, f)| (w, Some(f)));
            let nanos = match fraction {
                None => 0,
                Some(fraction) => {
                    digits(fraction)?;
                    let padded: String = fraction
                        .chars()
                        .chain(std::iter::repeat('0'))
                        .take(9)
                        .collect();
                    padded.parse().ok()?
                }
            };
            (two_digit(whole, 59)?, nanos)
        }
    };
    let time = NaiveTime::from_hms_nano_opt(
        two_digit(hours, 23)?,
        two_digit(minutes, 59)?,
        second,
        nanos,
    )?;
    let offset = FixedOffset::east_opt(offset_seconds)?;
    offset
        .from_local_datetime(&date.and_time(time))
        .single()
        .map(|dt| dt.with_timezone(&Utc))
}

pub fn path_issue(error: serde_path_to_error::Error<serde_json::Error>) -> Vec<Issue> {
    let path = error
        .path()
        .iter()
        .filter_map(|segment| match segment {
            serde_path_to_error::Segment::Seq { index } => Some(Value::from(*index)),
            serde_path_to_error::Segment::Map { key } => Some(Value::from(key.as_str())),
            serde_path_to_error::Segment::Enum { variant } => Some(Value::from(variant.as_str())),
            serde_path_to_error::Segment::Unknown => None,
        })
        .collect();
    vec![Issue {
        path,
        message: error.into_inner().to_string(),
    }]
}

pub fn decode<T: DeserializeOwned>(value: Value) -> Result<T, Vec<Issue>> {
    serde_path_to_error::deserialize(value).map_err(path_issue)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_paths() {
        assert!(is_internal_target_path("/posts/a%20b"));
        assert!(!is_internal_target_path("//evil.com"));
        assert!(!is_internal_target_path("/a/../b"));
        assert!(!is_internal_target_path("/a/%2e%2e"));
        assert!(!is_internal_target_path("/a/%zz"));
        assert!(!is_internal_target_path("/a?b"));
        assert!(!is_internal_target_path("/a/%2F"));
    }

    #[test]
    fn iso_datetimes() {
        assert!(parse_iso_datetime("2026-10-06T12:00:00.123Z").is_some());
        assert!(parse_iso_datetime("2026-10-06T12:00Z").is_some());
        assert!(parse_iso_datetime("2024-02-29T00:00:00-05:30").is_some());
        assert!(parse_iso_datetime("2026-02-29T00:00:00Z").is_none());
        assert!(parse_iso_datetime("2026-10-06 12:00:00Z").is_none());
        assert!(parse_iso_datetime("2026-10-06T12:00:00").is_none());
        assert_eq!(
            parse_iso_datetime("2026-10-06T12:00:00+08:00").unwrap(),
            parse_iso_datetime("2026-10-06T04:00:00Z").unwrap()
        );
    }
}
