use std::convert::Infallible;
use std::sync::Arc;

use bytes::Bytes;
use http_body_util::{BodyExt, Full, Limited};
use hyper::body::Incoming;
use hyper::header::{CONTENT_TYPE, HeaderMap};
use hyper::{Method, Request, Response, StatusCode};
use serde_json::{Value, json};

use crate::service::{RelayError, RelayService, WebhookRequest};
use crate::validate::decode_uri_component;

const MAX_BODY_BYTES: usize = 64 * 1024;

type Reply = Result<(u16, Value), RelayError>;

fn json_response(status: u16, body: &Value) -> Response<Full<Bytes>> {
    let mut response = Response::new(Full::new(Bytes::from(body.to_string())));
    *response.status_mut() =
        StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    response.headers_mut().insert(
        CONTENT_TYPE,
        "application/json; charset=utf-8".parse().unwrap(),
    );
    response
}

fn error_response(error: RelayError) -> Response<Full<Bytes>> {
    match error {
        RelayError::Http {
            status,
            code,
            message,
        } => json_response(status, &json!({ "error": code, "message": message })),
        RelayError::Validation(issues) => json_response(
            422,
            &json!({ "error": "validation_failed", "message": "Request validation failed", "issues": issues }),
        ),
        RelayError::Internal(message) => {
            eprintln!("{message}");
            json_response(
                500,
                &json!({ "error": "internal_error", "message": "Internal server error" }),
            )
        }
    }
}

async fn read_body(body: Incoming) -> Result<Bytes, RelayError> {
    match Limited::new(body, MAX_BODY_BYTES).collect().await {
        Ok(collected) => Ok(collected.to_bytes()),
        Err(error) if error.is::<http_body_util::LengthLimitError>() => Err(RelayError::Http {
            status: 413,
            code: "body_too_large",
            message: "Request body exceeds 64 KiB",
        }),
        Err(error) => Err(RelayError::Internal(error.to_string())),
    }
}

async fn read_json(body: Incoming) -> Result<Value, RelayError> {
    serde_json::from_slice(&read_body(body).await?).map_err(|_| RelayError::Http {
        status: 400,
        code: "invalid_json",
        message: "Request body must be JSON",
    })
}

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

fn path_param(segment: &str) -> Result<String, RelayError> {
    decode_uri_component(segment)
        .ok_or_else(|| RelayError::Internal("URIError: URI malformed".into()))
}

fn single_segment(value: Option<&str>) -> Option<&str> {
    value.filter(|segment| !segment.is_empty() && !segment.contains('/'))
}

async fn route(service: &RelayService, request: Request<Incoming>) -> Reply {
    let (parts, body) = request.into_parts();
    let path = parts.uri.path();
    let method = &parts.method;
    let authorization = header(&parts.headers, "authorization");

    if method == Method::GET && path == "/health" {
        return Ok((200, json!({ "ok": true })));
    }
    if method == Method::POST && path == "/v1/installations" {
        return Ok((
            201,
            service
                .register_installation(read_json(body).await?)
                .await?,
        ));
    }

    let installation_id = single_segment(
        path.strip_prefix("/v1/installations/")
            .and_then(|rest| rest.strip_suffix("/token")),
    );
    if method == Method::PUT
        && let Some(installation_id) = installation_id
    {
        let input = read_json(body).await?;
        let id = path_param(installation_id)?;
        return Ok((
            200,
            service
                .update_installation_token(&id, authorization, input)
                .await?,
        ));
    }

    if method == Method::POST && path == "/v1/source-activations" {
        return Ok((201, service.create_activation_ticket(authorization).await?));
    }
    if method == Method::POST && path == "/v1/source-activations/claim" {
        let input = read_json(body).await?;
        return Ok((
            201,
            service
                .claim_source_activation(authorization, input)
                .await?,
        ));
    }

    let bindings = path.strip_prefix("/v1/bindings/");
    if let Some(binding_id) = single_segment(bindings) {
        if method == Method::GET {
            return Ok((
                200,
                service
                    .get_binding(authorization, &path_param(binding_id)?)
                    .await?,
            ));
        }
        if method == Method::DELETE {
            return Ok((
                200,
                service
                    .revoke_binding(authorization, &path_param(binding_id)?)
                    .await?,
            ));
        }
    }
    let preferences_binding =
        single_segment(bindings.and_then(|rest| rest.strip_suffix("/preferences")));
    if method == Method::PUT
        && let Some(binding_id) = preferences_binding
    {
        let input = read_json(body).await?;
        let id = path_param(binding_id)?;
        return Ok((
            200,
            service
                .update_binding_preferences(authorization, &id, input)
                .await?,
        ));
    }

    if method == Method::POST && path == "/v1/webhooks/mx-core" {
        let raw_body = read_body(body).await?;
        let result = service
            .accept_event(WebhookRequest {
                raw_body: &raw_body,
                source_id: header(&parts.headers, "x-push-source"),
                delivery_id: header(&parts.headers, "x-push-delivery"),
                timestamp: header(&parts.headers, "x-push-timestamp"),
                signature: header(&parts.headers, "x-push-signature"),
            })
            .await?;
        return Ok((202, result));
    }

    Err(RelayError::Http {
        status: 404,
        code: "not_found",
        message: "Route not found",
    })
}

pub async fn handle(
    service: Arc<RelayService>,
    request: Request<Incoming>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    Ok(match route(&service, request).await {
        Ok((status, body)) => json_response(status, &body),
        Err(error) => error_response(error),
    })
}
