use anyhow::{bail, Context, Result};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json;
use tokio::time::{sleep, Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubUser {
    pub login: String,
    pub id: u64,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AuthSession {
    #[allow(dead_code)]
    pub access_token: String,
    pub user: GithubUser,
}

pub async fn request_device_code(client_id: &str) -> Result<DeviceCodeResponse> {
    let client = Client::new();
    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id), ("scope", "read:user")])
        .send()
        .await
        .context("GitHub device code request failed")?;

    let status = response.status();
    let body = response
        .text()
        .await
        .context("Failed to read GitHub device code response")?;

    #[derive(Deserialize)]
    struct DeviceCodePayload {
        device_code: Option<String>,
        user_code: Option<String>,
        verification_uri: Option<String>,
        expires_in: Option<u64>,
        interval: Option<u64>,
        error: Option<String>,
        error_description: Option<String>,
    }

    let payload: DeviceCodePayload =
        serde_json::from_str(&body).context("Invalid device code response")?;

    if !status.is_success() {
        let err = payload.error.unwrap_or_else(|| "unknown_error".to_string());
        let detail = payload
            .error_description
            .unwrap_or_else(|| "Unknown error".to_string());
        bail!("GitHub device code error: {} ({})", err, detail);
    }

    if let Some(err) = payload.error {
        let detail = payload
            .error_description
            .unwrap_or_else(|| "Unknown error".to_string());
        bail!("GitHub device code error: {} ({})", err, detail);
    }

    let device_code = payload.device_code.ok_or_else(|| {
        anyhow::anyhow!("Device code missing. Check OAuth App + Device Flow settings.")
    })?;
    let user_code = payload.user_code.ok_or_else(|| {
        anyhow::anyhow!("User code missing. Check OAuth App + Device Flow settings.")
    })?;
    let verification_uri = payload.verification_uri.ok_or_else(|| {
        anyhow::anyhow!("Verification URI missing. Check OAuth App + Device Flow settings.")
    })?;
    let expires_in = payload.expires_in.ok_or_else(|| {
        anyhow::anyhow!("Expiry missing. Check OAuth App + Device Flow settings.")
    })?;
    let interval = payload.interval.ok_or_else(|| {
        anyhow::anyhow!("Interval missing. Check OAuth App + Device Flow settings.")
    })?;

    Ok(DeviceCodeResponse {
        device_code,
        user_code,
        verification_uri,
        expires_in,
        interval,
    })
}

pub async fn complete_device_flow(
    client_id: &str,
    client_secret: Option<&str>,
    device_code: &str,
    max_wait_seconds: Option<u64>,
) -> Result<AuthSession> {
    let token = poll_access_token(client_id, client_secret, device_code, max_wait_seconds).await?;
    let user = fetch_user(&token).await?;
    Ok(AuthSession {
        access_token: token,
        user,
    })
}

#[derive(Debug)]
pub enum VerifyError {
    Unauthorized,
    Offline(String),
    Other(String),
}

pub async fn verify_access_token(
    access_token: &str,
) -> std::result::Result<GithubUser, VerifyError> {
    let client = Client::new();
    let response = client
        .get("https://api.github.com/user")
        .header("User-Agent", "Guardian")
        .bearer_auth(access_token)
        .send()
        .await;

    let response = match response {
        Ok(resp) => resp,
        Err(err) => {
            if err.is_connect() || err.is_timeout() {
                return Err(VerifyError::Offline(err.to_string()));
            }
            return Err(VerifyError::Other(err.to_string()));
        }
    };

    if response.status() == StatusCode::UNAUTHORIZED {
        return Err(VerifyError::Unauthorized);
    }
    if !response.status().is_success() {
        return Err(VerifyError::Other(format!(
            "GitHub user fetch failed: {}",
            response.status()
        )));
    }

    response
        .json::<GithubUser>()
        .await
        .map_err(|e| VerifyError::Other(e.to_string()))
}

async fn poll_access_token(
    client_id: &str,
    client_secret: Option<&str>,
    device_code: &str,
    max_wait_seconds: Option<u64>,
) -> Result<String> {
    let client = Client::new();
    let start = Instant::now();
    let mut interval_secs = 5u64;
    let timeout_secs = max_wait_seconds.unwrap_or(600);

    loop {
        if start.elapsed().as_secs() > timeout_secs {
            anyhow::bail!(
                "Authorization pending. Please complete GitHub verification and try again."
            );
        }

        let mut params = vec![
            ("client_id", client_id),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ];
        if let Some(secret) = client_secret {
            params.push(("client_secret", secret));
        }

        let response = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&params)
            .send()
            .await
            .context("GitHub token polling failed")?;

        let payload = response
            .json::<AccessTokenResponse>()
            .await
            .context("Invalid token response")?;

        if let Some(token) = payload.access_token {
            return Ok(token);
        }

        match payload.error.as_deref() {
            Some("authorization_pending") => {
                if start.elapsed().as_secs() + interval_secs > timeout_secs {
                    anyhow::bail!(
                        "Authorization pending. Please complete GitHub verification and try again."
                    );
                }
                sleep(Duration::from_secs(interval_secs)).await;
            }
            Some("slow_down") => {
                interval_secs = (interval_secs + 5).min(20);
                if start.elapsed().as_secs() + interval_secs > timeout_secs {
                    anyhow::bail!(
                        "Authorization pending. Please complete GitHub verification and try again."
                    );
                }
                sleep(Duration::from_secs(interval_secs)).await;
            }
            Some(err) => {
                let detail = payload
                    .error_description
                    .unwrap_or_else(|| "Unknown error".to_string());
                anyhow::bail!("GitHub auth error: {} ({})", err, detail);
            }
            None => {
                sleep(Duration::from_secs(interval_secs)).await;
            }
        }
    }
}

async fn fetch_user(access_token: &str) -> Result<GithubUser> {
    let client = Client::new();
    let response = client
        .get("https://api.github.com/user")
        .header("User-Agent", "Guardian")
        .bearer_auth(access_token)
        .send()
        .await
        .context("GitHub user fetch failed")?;

    if response.status() == StatusCode::UNAUTHORIZED {
        bail!("GitHub auth error: unauthorized");
    }
    if !response.status().is_success() {
        bail!("GitHub user fetch failed: {}", response.status());
    }

    response
        .json::<GithubUser>()
        .await
        .context("Invalid GitHub user response")
}
