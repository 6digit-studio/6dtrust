# Inbox

**Depends on:** upgrade-only vouch  
**Blocks:** GitHub App merge ingest  
**Touches:** migration, `src/lib/server/inbox.ts`, `src/routes/inbox/` or extend `/dashboard`

## Problem

Maintainers need a queue of people they've actually worked with (merged PRs, later
reviews) — suggest vouches, don't auto-write edges.

## Done when

- [x] Table `inbox_suggestions`: voucher_id, subject_github, source, context jsonb,
      last_seen_at, created_at, dismissed_at, acted_at, acted_level
- [x] Unique open row per `(voucher_id, subject_github, source)` — upsert updates context + last_seen_at
- [x] `POST` ingest function (internal, used by GitHub handler later) — skips bots, requires voucher identity
- [x] Logged-in UI lists open suggestions with context line from `context` (`/inbox`)
- [x] Four actions: Dismiss, Known (1), Vouch (2), Trust (3) — upgrade-only vouch + set acted_at
- [x] Test-ingest path (admin action `?/testIngest`) stands in for the GitHub handler
- [ ] Manual test: ingest via admin, act from `/inbox`, verify vouch + recompute — **needs a live login**

## Out of scope

- GitHub App (separate brief)
- Email notifications
- Re-open dismissed on new merge (v1: new merge after dismiss creates fresh row if dismissed_at set — document behavior)

## UI sketch

```
@alice                          [Dismiss]
  Merged PR #412 in owner/repo · 3d ago
  [ Known ]  [ Vouch ]  [ Trust ]
```

Disable buttons where existing vouch from you is already ≥ that level.

## Test plan

- Ingest twice same pair → one row, updated last_seen_at
- Act Known → vouch row + acted_at
- Act Known when already Trusted → no-op
- Dismiss → hidden; ingest again → new suggestion (if we choose that behavior)
