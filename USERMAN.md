# User Manual — FINNS CCTV Blacklist Notification

**Version:** 1.0.0
**Author:** Farid Hartono Gunawan (farid.gunawan@finnsbeachclub.com)

## 1. Purpose

This application forwards Dahua DSS V8.7 face recognition blacklist alerts to a Google Chat space in real time. When a camera detects a face matching the blacklist, a notification card is posted automatically, including the detected face, similarity score, camera location, and detection time.

## 2. When and How the Notification Is Triggered

1. A CCTV camera connected to Dahua DSS performs live face recognition against the configured blacklist group.
2. When a face match is found, Dahua DSS raises an alarm and immediately pushes it (as an XML payload) to the application's webhook endpoint (`MIDDLEWARE_WEBHOOK_URL`), which the application registered with Dahua DSS at startup.
3. The application reads the alarm code from the payload and calls back to Dahua DSS to retrieve full detection detail — matched person, similarity score, camera, and the snapshot/reference images.
4. The application formats this detail into a card and posts it to the configured Google Chat space via an Incoming Webhook.
5. The sequence is automatic and normally completes within a few seconds of the detection.

The trigger is fully automatic — no manual action is required to raise a notification, and only alarms of type "alarm raised" (not "alarm cleared") produce a message.

Requirements in Dahua DSS:

- The blacklist alarm plan must have the same user the application logs in as (`DAHUA_USERNAME`) as its linked user. Otherwise Dahua does not push the alarm.
- The application does not filter by alarm type. Every alarm Dahua delivers to it produces a card, so limit the alarm plan to blacklist alarms.

## 3. What You Will See in Google Chat

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

## 4. Operating Notes

- **Image size limit.** Google Chat rejects messages larger than 32 KB. Snapshot and reference images are embedded directly in the message; if the original photo from Dahua is large, Google Chat rejects the message. The application then resends the alert once without images and adds an "Images omitted" note to the card. This is a platform limit.
- **No action buttons.** Images are embedded in the card; there is no separate link or button.
- **Duplicate detections.** The same person may trigger multiple alerts in quick succession if detected by the camera more than once.

## 5. Starting and Stopping the Application

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
Expected response: HTTP 200 with `{"status":"ok","subscribed":true}`. HTTP 503 with `"status":"degraded"` means the application is running but has not yet logged in to Dahua DSS and subscribed to alarms; it retries every 30 seconds.

## 6. Common Issues

| Symptom | Likely Cause | Action |
|---|---|---|
| No notifications arrive at all | Dahua cannot reach the middleware's callback URL, the alarm plan's linked user is not the application's Dahua user, or the subscription was lost | Verify firewall rules allow the Dahua subnet to reach `MIDDLEWARE_WEBHOOK_URL`, check the alarm plan's linked user, and check that `/health` returns 200 (`Successfully subscribed to alarm notifications` appears in the logs). If Dahua DSS was restarted, restart the service to re-subscribe |
| Card has no images and shows "Images omitted" | Message exceeded Google Chat's 32 KB limit (large photo) | No action needed for isolated occurrences; the logs show `Google Chat rejected the payload` followed by `Resending without images` |
| Card shows `Unknown` and `0%` similarity | Dahua returned no face detail for the alarm | Check the `GetAlarmFaceRecognitionInfo response` log line for the returned `code` |
| Logs show repeated `Auth failed` (code 7000) | Dahua session token expired | The application re-authenticates automatically; if the issue persists, restart the service |
| Target name ends with an unexpected `null` | Missing last name in the Dahua person record | Cosmetic only; the application strips a trailing `null` automatically |

## 7. Escalation

For issues not covered above, collect the following before contacting support:
- Output of `pm2 logs dss-blacklist-gchat --lines 100 --nostream`
- Approximate time of the failed detection
- Screenshot of the Google Chat message (if one was received)