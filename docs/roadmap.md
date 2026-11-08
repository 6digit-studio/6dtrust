# Roadmap — pre-launch work

Living index for what to build next. Thin briefs live alongside this file.
Update status inline as things land.

**Product shape (already agreed):**

- Community roots (OSC, rust, …) = shared worldviews for badges and triage
- Vouches are global signed edges; roots only change *whose seeds* interpret them
- Growth = people vouching, not synthetic signals or auto-edges
- Merge hooks → **inbox suggestions**, not automatic vouches
- Badge = human readout; trust JSON = machine readout

---

## Build order

Do these in order. Later items assume earlier contracts exist.

| # | Work | Brief | Status |
|---|------|-------|--------|
| 1 | Persist distance at recompute + upgrade-only vouch | [upgrade-only-vouch.md](./upgrade-only-vouch.md) | **done** — deployed (migrate 0008 applied) |
| 2 | Trust read API (`/trust/{root}/{handle}.json`) | [trust-read-api.md](./trust-read-api.md) | **done** — deployed + verified live |
| — | Edge cache layer (badge + trust JSON, portable headers) | infra track | **done** — all 3 read endpoints edge-cache (verified HIT); epoch-purge later |
| 3 | Inbox (schema, API, UI) | [inbox.md](./inbox.md) | not started |
| 4 | Badge → profile vouch loop | [badge-vouch-loop.md](./badge-vouch-loop.md) | not started |
| 5 | GitHub App → inbox (merge only) | [github-app.md](./github-app.md) | not started |
| 6 | Paid private roots | — | later |

**Parallelization:** 1+2 can be one PR. 3 blocks 5. 4 needs 1 (upgrade-only) and benefits from 2 (payload URLs in UI). Don't split 1 across two agents.

**Ownership (fill in):**

| Work | Agent / human |
|------|----------------|
| 1–2 | |
| 3 | |
| 4 | |
| 5 | |

---

## Shared contracts

Freeze these before parallel work.

### Trust payload — `GET /trust/{root}/{handle}.json`

```json
{
  "root": "osc",
  "handle": "alice",
  "level": 0,
  "levelName": "pending",
  "accepted": false,
  "distance": null,
  "isSeed": false,
  "status": "unclaimed",
  "computedAt": "2026-06-16T12:00:00.000Z",
  "badgeUrl": "https://6dtrust.com/badge/osc/alice",
  "profileUrl": "https://6dtrust.com/u/alice?root=osc"
}
```

- `level` / `levelName`: engine 0–3, names from `src/lib/levels.ts`
- `accepted`: in this root's accept-set (level > 0)
- `distance`: hop count from nearest seed via vouch edges at last compute; `null` if unreachable or not computed
- `status`: `claimed` | `unclaimed` | `null` (null = no identity row yet)
- Always **200** for valid handle + root slug; pending is not an error
- Invalid root → 404; malformed handle → 400

### Inbox suggestion (API + DB)

```json
{
  "id": "uuid",
  "subjectGithub": "alice",
  "source": "github:merge",
  "context": {
    "repo": "owner/repo",
    "pr": 412,
    "title": "Fix badge layout",
    "url": "https://github.com/owner/repo/pull/412",
    "mergedAt": "2026-06-16T12:00:00.000Z"
  },
  "lastSeenAt": "2026-06-16T12:00:00.000Z",
  "createdAt": "2026-06-16T10:00:00.000Z"
}
```

- One open suggestion per `(voucher_id, subject_github, source)` — updates `lastSeenAt` + context on repeat
- **Dismiss** → set `dismissed_at`, hide from inbox
- **Known / Vouch / Trust** → upgrade-only vouch at 1/2/3, then mark `acted_at` + level chosen
- Ingest drops bots; voucher = merger with a linked 6d identity

---

## Already shipped (this thread)

- Featured-root landing demo (icons, carousel, fixed scroll, horizontal layout)
- Root profile chrome includes display name
- Generic badge example (no real handles in snippet)
- `avatarUrl` on public roots for landing

---

## Explicitly not now

- Synthetic trust from GitHub stars / external signals in max-flow
- Auto-mint a root per repo
- Auto-vouch on merge without inbox review
- Per-repo roots as default triage unit (community roots stay primary)
