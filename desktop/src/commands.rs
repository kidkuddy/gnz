use serde_json::Value;
use tauri::State;

pub struct BackendState {
    pub port: u16,
    pub client: reqwest::Client,
}

fn base_url(port: u16, path: &str) -> String {
    let path = path.trim_start_matches('/');
    format!("http://127.0.0.1:{}/api/v1/{}", port, path)
}

/// Extract the `data` field from the API envelope `{"ok": true, "data": ...}`.
/// If no `data` field, return the body as-is.
fn unwrap_envelope(body: Value) -> Result<Value, String> {
    if let Some(obj) = body.as_object() {
        if let Some(ok) = obj.get("ok") {
            if ok.as_bool() == Some(false) {
                let msg = obj
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("unknown error");
                return Err(msg.to_string());
            }
            if let Some(data) = obj.get("data") {
                return Ok(data.clone());
            }
        }
    }
    Ok(body)
}

#[tauri::command]
pub async fn proxy_get(
    state: State<'_, BackendState>,
    path: String,
) -> Result<Value, String> {
    let url = base_url(state.port, &path);
    let resp = state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status();
    let body = resp
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse response: {}", e))?;

    if !status.is_success() {
        return Err(format!("backend returned {}: {}", status, body));
    }

    unwrap_envelope(body)
}

#[tauri::command]
pub async fn proxy_post(
    state: State<'_, BackendState>,
    path: String,
    body: Value,
) -> Result<Value, String> {
    let url = base_url(state.port, &path);
    let resp = state
        .client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status();
    let resp_body = resp
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse response: {}", e))?;

    if !status.is_success() {
        return Err(format!("backend returned {}: {}", status, resp_body));
    }

    unwrap_envelope(resp_body)
}

#[tauri::command]
pub async fn proxy_put(
    state: State<'_, BackendState>,
    path: String,
    body: Value,
) -> Result<Value, String> {
    let url = base_url(state.port, &path);
    let resp = state
        .client
        .put(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status();
    let resp_body = resp
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse response: {}", e))?;

    if !status.is_success() {
        return Err(format!("backend returned {}: {}", status, resp_body));
    }

    unwrap_envelope(resp_body)
}

#[tauri::command]
pub async fn proxy_delete(
    state: State<'_, BackendState>,
    path: String,
) -> Result<Value, String> {
    let url = base_url(state.port, &path);
    let resp = state
        .client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status();
    let body = resp
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse response: {}", e))?;

    if !status.is_success() {
        return Err(format!("backend returned {}: {}", status, body));
    }

    unwrap_envelope(body)
}
