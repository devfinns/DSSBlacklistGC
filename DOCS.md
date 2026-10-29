# Technical Documentation — FINNS CCTV Blacklist Notification

**Version:** 1.0.0
**Author:** Farid Hartono Gunawan (farid.gunawan@finnsbeachclub.com)

## 1. Overview

This middleware bridges Dahua DSS V8.7 face recognition blacklist alarms and Google Chat. It authenticates with Dahua DSS, subscribes to alarm push notifications, receives alarms via an HTTP callback, enriches them with face recognition detail and images, and posts a formatted card to a Google Chat space via Incoming Webhook.

## 2. Architecture

```
Dahua DSS  --(XML push)-->  Middleware (Express)  --(cardsV2 JSON)-->  Google Chat
    ^                              |
    |______(REST API calls)_______|
```

The middleware is a single Node.js process (`src/server.js`) with no database or persistent storage. All state (session token, credential, timers) lives in memory and is rebuilt on every restart.

## 3. Module Reference

| File                   | Responsibility                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `config.js`            | Loads and validates required environment variables                                                      |
| `auth.js`              | Dahua HTTP Digest login, session keep-alive, token/credential refresh, auth-retry wrapper               |
| `dahuaClient.js`       | Shared Axios instance for Dahua calls (accepts self-signed TLS certificates)                            |
| `dahua.js`             | Dahua REST API calls: subscribe to alarms, fetch face recognition detail, add a person to the blacklist |
| `dahuaImageFetcher.js` | Fetches a Dahua image URL and returns it as a base64 data URI                                           |
| `alarmParser.js`       | Parses the XML alarm payload Dahua sends to the callback endpoint                                       |
| `gchat.js`             | Builds the Google Chat `cardsV2` payload, posts it to the webhook, and resends without images on a 400  |
| `logger.js`            | Prepends a GMT+8 timestamp to every `console.log` / `warn` / `error` call                               |
| `server.js`            | Express app: callback endpoint, health check, startup orchestration                                     |

## 4. Authentication Flow

Dahua DSS uses a two-step HTTP Digest login (`brms/api/v1.0/accounts/authorize`):

1. First request with only `userName` triggers a `401` response containing `realm` and `randomKey`.
2. The client computes a signature (`temp1`–`temp4`, each an MD5 hash, per Dahua's documented algorithm) and resends the request with `randomKey` and `signature`.
3. A successful response returns `token`, `credential`, and `tokenRate`.

Two values are cached in memory:

- **`token`** — used as `X-Subject-Token` for all REST API calls.
- **`credential`** — appended as a `?token=` query parameter to image URLs.

### Keeping the session alive

- **Keep-alive** (`PUT /accounts/keepalive`) runs every 20 seconds to keep `token` valid. Three consecutive failures trigger a full re-login.
- **Token update** (`POST /accounts/updateToken`) runs at 2/3 of the server-provided `tokenRate` (default 1800s, so ~20 minutes) to rotate `token` and, when present, `credential`. Any failure (network error or unexpected response) triggers a full re-login.
- **`withAuthRetry()`** wraps every Dahua REST call in `dahua.js`. If a response body carries `code: 7000` (Auth failed), it re-logs in once and retries the call.

### Known limitation

The example `keepalive` response in Dahua's API documentation shows `"credential": null`, so keep-alive is not relied on to refresh `credential` (this has not been verified in production logs; the keep-alive handler still stores a credential if one is ever returned). `credential` can therefore go stale between `updateToken` cycles. To reduce this risk, `server.js` performs a full `loginDahua()` call immediately before fetching images for each alarm, in addition to the scheduled refresh cycles.

## 5. Alarm Ingestion

Dahua posts alarms to `MIDDLEWARE_WEBHOOK_URL` as `application/xml`, not JSON. Example payload:

```xml
<AlarmMessageDTO>
  <callbackType>1</callbackType>
  <alarmCode>{...}</alarmCode>
  <sourceCode>1000009$1$0$13</sourceCode>
  <sourceName>VIP Row 2</sourceName>
  <alarmType>100006</alarmType>
  <alarmTypeName>Blaclist</alarmTypeName>
  <alarmTime>1787553174</alarmTime>
  <alarmPictures><alarmPictures>https://...</alarmPictures></alarmPictures>
  <signature>...</signature>
  <alarmStatus>1</alarmStatus>
</AlarmMessageDTO>
```

`server.js` accepts any `Content-Type` as raw text (`express.text({ type: '*/*' })`) and parses it with `alarmParser.js` (backed by `xml2js`). Key fields:

- `callbackType` — `1` means the alarm was raised; `2` means it cleared. Only `1` is processed.
- `alarmCode` — required to look up face recognition detail.
- `sourceCode` — the Dahua channel code, passed as `deviceCode` to the detail API.
- `alarmTime` — Unix timestamp. It is sent to the detail API as `alarmDate` and used for the displayed time if the detail response has none.

Dahua-side prerequisites and behaviour:

- Per Dahua's API guide, the linked user of the alarm plan must be the same user that subscribed to alarms. In Dahua DSS, set the blacklist alarm plan's linked user to the account in `DAHUA_USERNAME`; otherwise Dahua does not push the alarm.
- The application does not filter by `alarmType`. Every raised alarm delivered to the callback produces a card, so restrict the alarm plan to blacklist alarms in Dahua DSS.

## 6. Face Detail and Image Retrieval

After parsing an alarm, the middleware calls `GetAlarmFaceRecognitionInfo` (`dahua.js`) with `alarmCode`, `deviceCode` (from `sourceCode`), and `alarmDate`. The response includes `name`, `similarity`, `repositoryName`, `detectionImageUrl`, and `repositoryImageUrl`.

Images are fetched by `dahuaImageFetcher.js`:

- The Dahua image URL is an internal address (e.g. `https://10.62.21.254`) that is not intended to be reachable from the internet, so it is not linked directly.
- The middleware downloads the image itself (with the session `credential` appended) and re-encodes it as a base64 `data:` URI, embedded directly in the card payload.
- If the response body is a small JSON object with `code: 7000` instead of image bytes, the middleware re-logs in and retries once.
- If an image cannot be retrieved, that image is omitted and the card is still sent.
- If the detail API returns no data, the card is still sent with `Unknown` as the name and `0%` similarity (no status line).

### Message size constraint

Google Chat enforces a 32,000-byte limit per message, including the `cardsV2` payload. Because images are embedded as base64 (which inflates size by ~33%), a large original photo can push the total payload over this limit, causing Google Chat to reject the message with `400 INVALID_ARGUMENT`. When Google Chat rejects a message with a `400` and the message contained images, `sendBlacklistAlert()` (`gchat.js`) resends the card once without images and adds an "Images omitted" note, so the alert is not lost. Both attempts are logged (`[GChat] Google Chat rejected the payload`, then `Resending without images`). A `400` on a message without images, or any other error, is only logged. No compression is currently applied — an earlier attempt to downscale/compress images before encoding caused messages to render as empty cards, and was reverted pending further investigation.

## 7. Google Chat Card Format

`gchat.js` builds a `cardsV2` payload with the following widgets, in order:

1. Status line (`HIGH` / `MEDIUM`), omitted below 80% similarity
2. Target Name / Similarity
3. Camera Location
4. Detection Time
5. Target Type
6. Snapshot Image (if available)
7. Reference Image (if available)
8. "Images omitted" note (only on the resend without images described in section 6)
9. Action Required footer text

Detection time is derived from `alarmTime` and formatted with `moment` in the server's local timezone. Log timestamps use a fixed GMT+8 offset regardless of server timezone.

The header (`title`/`subtitle`) cannot be colored in the `cardsV2` format, which is why the status indicator is rendered as a `textParagraph` with inline `<font color>` HTML instead.

## 8. Environment Variables

| Variable                    | Required | Default             | Description                                            |
| --------------------------- | -------- | ------------------- | ------------------------------------------------------ |
| `DAHUA_BASE_URL`            | Yes      | —                   | Dahua DSS base URL, e.g. `https://10.62.21.254:443`    |
| `DAHUA_USERNAME`            | Yes      | —                   | Dahua DSS login username                               |
| `DAHUA_PASSWORD`            | Yes      | —                   | Dahua DSS login password                               |
| `GOOGLE_CHAT_WEBHOOK_URL`   | Yes      | —                   | Incoming Webhook URL for the target Google Chat space  |
| `MIDDLEWARE_WEBHOOK_URL`    | Yes      | —                   | Callback URL that Dahua DSS pushes alarms to           |
| `MIDDLEWARE_PORT`           | No       | `3000`              | Port the Express server listens on                     |
| `DAHUA_SUBSCRIBE_SIGNATURE` | No       | `random_string_123` | Arbitrary string sent when subscribing to Dahua alarms |
| `INIT_RETRY_MS`             | No       | `30000`             | Delay in milliseconds between startup login/subscribe retries |

## 9. Deployment Notes

- The middleware server must have outbound network access to Dahua DSS.
- Dahua DSS uses a self-signed TLS certificate; `dahuaClient.js` disables certificate verification (`rejectUnauthorized: false`) for Dahua connections only. The Google Chat connection uses the default Axios instance with full TLS verification.
- After pulling new code, run `npm install` before restarting; a new dependency that is not installed prevents the service from starting.
- Run under a process manager (PM2) for automatic restarts:
  ```bash
  pm2 start src/server.js --name dss-blacklist-gchat
  pm2 save
  ```
- The middleware does not require an inbound-reachable public URL for images (images are embedded, not linked), but `MIDDLEWARE_WEBHOOK_URL` must still be reachable from Dahua DSS for alarm delivery.

## 10. Known Issues and History

- **Credential staleness (resolved with mitigation):** the session `credential` used for image URLs is not refreshed by Dahua's keep-alive endpoint. Mitigated by a pre-fetch re-login on every alarm, which adds one login (two requests) per alarm.
- **Image compression (reverted):** downscaling/compressing images with `sharp` before base64 encoding produced empty Google Chat cards instead of a size error. The cause was not fully diagnosed; compression was removed in favor of sending original-size images, accepting occasional 32 KB limit failures.
- **Subscription is registered once it succeeds:** startup login and subscription are retried every 30 seconds (`INIT_RETRY_MS`) until both succeed, and a subscribe response with a `code` other than `1000` counts as a failure. After success the subscription is not renewed: if Dahua DSS restarts and drops it, restart the application to re-register.
- **Trailing `null` in target names:** Dahua's `GetAlarmFaceRecognitionInfo` response concatenates first and last name server-side; when the last name is empty, the literal string `null` is appended. `gchat.js` strips a trailing `null` from the displayed name.

## 11. API Endpoints

### 11.1 Dahua DSS endpoints called by the application

All calls are made to `DAHUA_BASE_URL`. Except for login, every call sends the session token in the `X-Subject-Token` header.

| # | Method | Path | Purpose | Source |
|---|---|---|---|---|
| 1 | POST | `/brms/api/v1.0/accounts/authorize` | Two-step digest login. The first call (username only) returns `401` with `realm` and `randomKey`; the second call (with `signature`) returns `token`, `credential`, and `tokenRate`. Runs at startup, before image retrieval for every alarm, and as a fallback when keep-alive or token update fails. | `auth.js` |
| 2 | PUT | `/brms/api/v1.0/accounts/keepalive` | Keeps the session token valid. Runs every 20 seconds. | `auth.js` |
| 3 | POST | `/brms/api/v1.0/accounts/updateToken` | Rotates the session token (and credential when returned). Runs at 2/3 of `tokenRate`. | `auth.js` |
| 4 | POST | `/brms/api/v1.1/push-data/alarm/subscribe` | Registers `MIDDLEWARE_WEBHOOK_URL` as the alarm callback. Runs at startup and is retried until it succeeds; a response `code` other than `1000` is treated as a failure. | `dahua.js` |
| 5 | POST | `/eams/api/v1.0/BRM/Alarm/GetAlarmFaceRecognitionInfo` | Retrieves matched person, similarity, and image URLs for an alarm. Request body: `data.alarmCode`, `data.alarmDate`, `data.deviceCode`. | `dahua.js` |
| 6 | GET | Image URL from step 5 (`detectionImageUrl`, `repositoryImageUrl`) or the alarm payload (`snapshotUrl`), with `?token={credential}` appended | Downloads the snapshot and reference images. Called once per image per alarm (a second time if the first returns `code: 7000`). | `dahuaImageFetcher.js` |

Defined but not currently called:

| Method | Path | Purpose | Source |
|---|---|---|---|
| POST | `/obms/api/v1.1/acs/person` | Adds a person to the blacklist group (`addPersonToBlacklist`). Exported but unused by `server.js`. | `dahua.js` |

### 11.2 Endpoints exposed by the application

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/dahua/push` | Receives alarm callbacks from Dahua DSS (XML body, any `Content-Type`). Always replies `200 OK` immediately and processes the alarm afterwards. |
| GET | `/health` | Returns `200 {"status":"ok","subscribed":true}` once the Dahua login and alarm subscription have succeeded, and `503 {"status":"degraded","subscribed":false}` until then. Does not verify ongoing Dahua or Google Chat connectivity. |

### 11.3 External endpoint called by the application

| Method | Target | Purpose | Source |
|---|---|---|---|
| POST | `GOOGLE_CHAT_WEBHOOK_URL` | Posts the `cardsV2` notification to the Google Chat space. | `gchat.js` |
