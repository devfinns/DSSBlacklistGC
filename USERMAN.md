# User Manual — Dahua DSS to Google Chat Middleware

**Version:** 1.0.0
**Author:** Farid Hartono Gunawan (farid.gunawan@finnsbeachclub.com)

## 1. Purpose

This application forwards Dahua DSS V8.7 face recognition blacklist alerts to a Google Chat space in real time. When a camera detects a face matching the blacklist, a notification card is posted automatically, including the detected face, similarity score, camera location, and detection time.

## 2. What You Will See in Google Chat

Each detection appears as a card in the configured Google Chat space:

- **Status line** — shown only when similarity is 80% or higher:
  - `HIGH` (red) for similarity ≥ 90%
  - `MEDIUM` (yellow) for similarity 80–89%
  - No status line for similarity below 80%
- **Target Name** and **Similarity** percentage
- **Camera Location**
- **Detection Time**
- **Target Type** (blacklist group name)
- **Snapshot Image** — the face captured by the camera at detection time
- **Reference Image** — the face on file in the blacklist group

## 3. Operating Notes

- **Image size limit.** Google Chat rejects messages larger than 32 KB. Snapshot and reference images are embedded directly in the message; if the original photo from Dahua is large, the message may occasionally fail to send. This is a platform limit, not an application error.
- **No action buttons.** Images render directly in the card; there is no separate link to click.
- **Duplicate detections.** The same person may trigger multiple alerts in quick succession if detected by the camera more than once.

## 4. Starting and Stopping the Application

The application runs as a background service managed by PM2 on the middleware server.

Check status:
```bash
pm2 status
```

View live logs:
```bash
pm2 logs dss-blacklist-gchat --lines 0
```

Restart after a configuration or code change:
```bash
pm2 restart dss-blacklist-gchat
```

Health check endpoint:
```bash
curl http://localhost:<MIDDLEWARE_PORT>/health
```
Expected response: `{"status":"ok"}`

## 5. Common Issues

| Symptom | Likely Cause | Action |
|---|---|---|
| No notifications arrive at all | Dahua cannot reach the middleware's callback URL | Verify firewall rules allow the Dahua subnet to reach `MIDDLEWARE_WEBHOOK_URL`, and confirm `Successfully subscribed to alarm notifications` appears in the logs at startup |
| Notification arrives but images are missing | Original snapshot is too large for Google Chat's 32 KB message limit | Check logs for a `Google Chat rejected the payload` entry; no action needed for isolated occurrences |
| Logs show repeated `Auth failed` (code 7000) | Dahua session token expired | The application re-authenticates automatically; if the issue persists, restart the service |
| Target name ends with an unexpected `null` | Missing last name in the Dahua person record | Cosmetic only; the application strips a trailing `null` automatically |

## 6. Escalation

For issues not covered above, collect the following before contacting support:
- Output of `pm2 logs dss-blacklist-gchat --lines 100 --nostream`
- Approximate time of the failed detection
- Screenshot of the Google Chat message (if one was received)