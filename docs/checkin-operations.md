# Check-in Operations Runbook

This runbook covers the weekly mandatory check-in for Closed Beta workspaces. It is for operators with super-admin access.

## Lifecycle

1. **Create** a draft edition in `/admin/closed-beta/checkins`.
2. **Publish** the edition: set an open window (`opensAt` optional, `closesAt` optional). The first published mandatory edition becomes active. Only one mandatory edition can be published at a time.
3. **Monitor** responses in `/admin/closed-beta/checkins/[id]/responses`. The `completionRate` field shows (completed / total active workspaces) * 100.
4. **Close** the edition when the window expires or you need to end the cycle. Closing stops blocking immediately and preserves all submitted answers.

## Exemptions

- **Grant** an exemption to a specific workspace to release its `CHECKIN_REQUIRED` block without requiring a response. Set `expiresAt` to control the exemption window.
- **Revoke** an exemption before its expiry to re-enable the gate.
- Expired exemptions are lazily expired at read time. No cron job runs `expireCheckinExemptions` automatically; call it explicitly in a maintenance script if you need bulk expiry.

## Kill-Switch / Rollout

Set the environment variable `CHECKIN_REQUIRED=false` to globally disable the mandatory check-in gate without deleting any responses.

- **Rollout**: deploy with `CHECKIN_REQUIRED=true` (or unset, which defaults to enabled).
- **Rollback**: set `CHECKIN_REQUIRED=false` and redeploy. All workspaces are immediately unblocked.
- The flag is read per-request; no database migration or code change is needed.

Do NOT set `CHECKIN_REQUIRED=false` in production unless you intend to disable the gate.

## Interpreting Metrics

| Field | Meaning |
|---|---|
| `totalWorkspaces` | Active beta enrollments at the time of the query |
| `completed` | Workspaces where at least one member submitted (first-wins unlock) |
| `pending` | Workspaces that have not responded or been exempted |
| `exempt` | Workspaces with an unexpired exemption |
| `completionRate` | `round((completed / totalWorkspaces) * 1000) / 10`, or null if 0 workspaces |
| `averageResponseSeconds` | Mean time from edition creation to first response for completed workspaces |

## Incident: Workspaces Blocked (CHECKIN_REQUIRED)

If workspaces report `CHECKIN_REQUIRED` errors:

1. Check whether a mandatory edition is published and overdue (`closesAt` in the past).
2. Grant an exemption to affected workspaces, or close the edition.
3. If urgent, set `CHECKIN_REQUIRED=false` to globally unblock.

## Retention

- **Responses**: retained indefinitely as historical audit. `resetCheckinResponse` resets workspace state to `pending` but preserves response records.
- **Invitations**: terminal invitations (accepted/expired/revoked/cancelled) are purged after 90 days by `purgeClosedBetaRetention`.
- **Audit events**: purged after 2 years.
- **Rate-limit rows**: purged after 24 hours.

## Quotas

- 30 primary workspace slots (configurable via admin panel).
- 3 guest slots per workspace (configurable via admin panel).
- Only one mandatory published edition at a time.
