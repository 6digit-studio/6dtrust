# 6dtrust

[![trust](https://www.6dtrust.com/badge/6dt/cocporn)](https://www.6dtrust.com)

**Attack-resistant trust, computed from your seeds.** Live at
[www.6dtrust.com](https://www.6dtrust.com).

Trust isn't global — it's subjective. The same person can be `trusted` under one
root and `pending` under another. There is no global verdict, only "trusted from
*this* viewpoint."

## What it is

- **Root-relative.** A *root* is a seed set. Trust is computed relative to it via
  Raph Levien's attack-resistant [Advogato](https://www.6dtrust.com/about)
  max-flow metric — a sybil flood past the flow bound does not lift trust.
- **GitHub-first identity.** Sign in with GitHub; signed edges connect identities in your trust graph. Handles for people who haven't signed up yet still anchor the graph.
- **Operator-minted roots.** Roots are minted by an admin, not created freely — the
  genuinely-trusted ones float organically from a curated start.
- **Self-authenticating badges.** Each badge reads live from the computed accept
  set and embeds anywhere through GitHub's image proxy:

  ```markdown
  [![trust](https://www.6dtrust.com/badge/<root>/<github-handle>)](https://www.6dtrust.com)
  ```

## Local development

```sh
bun install
docker compose up -d          # local Postgres
cp .env.example .env          # then fill in GitHub OAuth creds
bun run migrate               # apply db/migrations
bun run dev
```

`bun test` runs the suite. Trust is computed off-graph by a worker
(`scripts/recompute-cron.sh`) that ships accept-set diffs to the serving DB —
deliberately not on the serverless hot path.
