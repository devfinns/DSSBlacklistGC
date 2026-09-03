# Dahua DSS to Google Chat Middleware

**Version:** 1.0.0
**Author:** Farid Hartono Gunawan (farid.gunawan@finnsbeachclub.com)

Node.js middleware that forwards Dahua DSS V8.7 face recognition blacklist alarms to a Google Chat space, with the detected face, similarity score, and camera details.

For end-user operation, see [userman.md](userman.md). For architecture and implementation detail, see [docs.md](docs.md).

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DAHUA_BASE_URL` | Yes | — | Dahua DSS base URL, e.g. `https://10.62.21.254:443` |
| `DAHUA_USERNAME` | Yes | — | Dahua DSS login username |
| `DAHUA_PASSWORD` | Yes | — | Dahua DSS login password |
| `GOOGLE_CHAT_WEBHOOK_URL` | Yes | — | Incoming Webhook URL for the target Google Chat space |
| `MIDDLEWARE_WEBHOOK_URL` | Yes | — | Callback URL that Dahua DSS pushes alarms to |
| `MIDDLEWARE_PORT` | No | `3000` | Port the server listens on |
| `DAHUA_SUBSCRIBE_SIGNATURE` | No | `random_string_123` | Arbitrary string used when subscribing to Dahua alarms |

## Running

```bash
npm start        # production
npm run dev       # auto-restart on file change
```

For production, run as a managed service:

```bash
pm2 start src/server.js --name dss-blacklist-gchat
pm2 save
```

Health check: `GET /health` → `{"status":"ok"}`

## Project Structure

```
src/
  config.js               Loads and validates environment variables
  auth.js                 Dahua digest login, keep-alive, token/credential refresh
  dahuaClient.js           Axios instance for Dahua (accepts self-signed TLS)
  dahua.js                Dahua REST calls: subscribe alarms, face recognition detail, add person
  dahuaImageFetcher.js     Fetches Dahua images and encodes them as base64 data URIs
  alarmParser.js           Parses the XML alarm payload from Dahua
  gchat.js                 Builds and sends the Google Chat card
  logger.js                Adds a GMT+8 timestamp to console output
  server.js                Express app, callback endpoint, startup orchestration
```

## Network Requirements

- Outbound access from the middleware server to Dahua DSS.
- Inbound access from Dahua DSS to `MIDDLEWARE_WEBHOOK_URL` (for alarm delivery only — images are embedded in messages, not linked, so no public image hosting is required).

## Known Limitations

- Google Chat rejects messages over 32 KB. Snapshot/reference images are embedded as base64 without compression, so a large original photo can occasionally cause a message to fail. See [docs.md](docs.md#6-face-detail-and-image-retrieval) for detail.
