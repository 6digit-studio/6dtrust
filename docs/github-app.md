# GitHub App → inbox (merge only)

**Depends on:** inbox schema + ingest API  
**Touches:** new package or `services/github/` in repo, webhook route, App manifest

## Problem

Graph growth should track real maintainer activity. Merged PRs should surface
authors in the voucher's inbox — not auto-vouch.

## Done when

- [ ] GitHub App created (settings doc in this file or README — no secrets in git)
- [ ] Webhook: `pull_request` closed, `merged === true`, default branch only
- [ ] Repo opt-in flag (config file in repo `.6dtrust.yml` or App installation setting — pick one, document)
- [ ] Voucher = GitHub user who merged; must map to claimed 6d identity via handle
- [ ] Calls inbox ingest with `source: github:merge`, context from PR payload
- [ ] Bots filtered (`[bot]`, dependabot, etc.)
- [ ] Invalid/unlinked merger → no-op (silent ok, log)

## Out of scope

- Auto-vouch
- Reviews / comments as sources (add later same ingest path)
- Org-wide policy beyond opt-in

## Test plan

- Webhook fixture JSON → ingest row for merger
- Bot author → dropped
- Merger without 6d account → dropped

## Install notes (fill when App exists)

- App name:
- Webhook URL:
- Permissions needed: `pull_requests: read`, `metadata: read`
- Events: `pull_request`
