# Dahua DSS to Google Chat Middleware

Node.js middleware that integrates the Dahua DSS V8.7 Face Recognition Blacklist with Google Chat notifications.

## How It Works

1. The middleware logs in to Dahua DSS using HTTP Digest authentication and keeps the token alive through periodic keep-alive calls and automatic refresh.
2. It subscribes to Dahua DSS alarm push notifications, providing its own callback URL.
3. When a camera detects a face on the blacklist, Dahua DSS sends an alarm (XML) to the middleware's callback endpoint.
4. The middleware parses the alarm, retrieves face recognition details from the Dahua API, formats a message, and sends it to Google Chat through an Incoming Webhook.

## Project Structure

```
src/
  config.js        Loads and validates environment variables
  auth.js          Dahua digest login, keep-alive, and automatic token refresh
  dahuaClient.js   Axios instance dedicated to Dahua (skips self-signed SSL verification)
  dahua.js         Dahua API calls: subscribe to alarms, get face recognition info, add person
  alarmParser.js   Parses the XML alarm payload sent by Dahua
  gchat.js         Formats messages and sends them to the Google Chat webhook
  logger.js        Adds a GMT+8 timestamp to every console log
  server.js        Express server, callback endpoint, and startup orchestration
```

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with values for your environment:

| Variable | Description |
|---|---|
| `DAHUA_BASE_URL` | Dahua DSS base URL, e.g. `https://10.62.21.254:443` |
| `DAHUA_USERNAME` | Dahua DSS login username |
| `DAHUA_PASSWORD` | Dahua DSS login password |
| `GOOGLE_CHAT_WEBHOOK_URL` | Incoming Webhook URL for the target Google Chat space |
| `MIDDLEWARE_PORT` | Port the middleware listens on (default `3000`) |
| `MIDDLEWARE_WEBHOOK_URL` | Callback URL that Dahua DSS can reach back to |
| `DAHUA_SUBSCRIBE_SIGNATURE` | Arbitrary string used to validate the alarm subscription signature |

## Running

```bash
npm start
```

For auto-restart during development:

```bash
npm run dev
```

For production, run it as a service with PM2:

```bash
pm2 start src/server.js --name dahua-blacklist-gchat
pm2 save
```

A health check endpoint is available at `GET /health`.

## Network Notes

- The middleware server must be able to reach Dahua DSS (outbound).
- Dahua DSS must be able to reach `MIDDLEWARE_WEBHOOK_URL` back (inbound) — make sure the firewall (ufw / security group) allows the middleware port from the Dahua DSS subnet.
- If Dahua DSS uses a self-signed certificate, `dahuaClient.js` is already configured to accept it (`rejectUnauthorized: false`) for Dahua connections only — the connection to Google Chat is still verified normally.

## Common Issues

- **`code: 7000, "Auth failed"`** — the Dahua token expired. Confirm `auth.js` is running its keep-alive and token refresh timers (already implemented).
- **Images in Google Chat won't open** — Dahua image URLs require a `?token={credential}` parameter, which `gchat.js` appends automatically.
- **Alarms never reach the middleware** — check the firewall on the middleware server, and confirm `subscribeAlarm()` succeeded at startup (look for the `Successfully subscribed to alarm notifications` log line).
