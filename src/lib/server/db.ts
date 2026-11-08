import postgres from 'postgres';
import { env } from '$env/dynamic/private';

// Single source of truth for DB access. Server-only ($lib/server can never be
// imported into client code). Raw SQL via postgres.js — our hand-written
// migrations in db/migrations are the schema source of truth.
const connectionString = env.DATABASE_URL;
if (!connectionString) {
	throw new Error('DATABASE_URL is not set — see .env.example');
}

// Serverless + pooler-safe options:
// - max: 1 — each serverless instance holds at most one backend connection, so
//   fan-out across Vercel functions doesn't exhaust Neon's pooled budget.
// - prepare: false — Neon's pooled endpoint is PgBouncer in transaction mode,
//   which reassigns backends between statements; named prepared statements can
//   then miss their backend under concurrency. Disabling them removes that whole
//   class of intermittent errors.
// SSL is carried by the connection string itself (sslmode=require on Neon,
// absent for local Postgres) — so prod gets TLS and local dev doesn't, with no
// branching here.
export const sql = postgres(connectionString, { max: 1, prepare: false });
