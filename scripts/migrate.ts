#!/usr/bin/env bun
/**
 * Migration runner — the zero-touch bring-up for a fresh database.
 *
 * Applies db/migrations/NNNN_*.sql in filename order, recording each applied
 * file in a schema_migrations table so it runs exactly once. The migrations
 * themselves are NOT idempotent (plain `create table` / `create index`), so
 * the tracking table is what makes re-runs safe — not the SQL.
 *
 * Each migration runs inside its own begin/commit, emitted as one simple-protocol
 * query so the transaction lives on a single connection: if any statement fails,
 * Postgres rolls the whole migration back and we abort loudly with the error.
 *
 *   bun run migrate            apply every pending migration (alias: `up`)
 *   bun run migrate status     show applied vs pending, in order
 *   bun run migrate baseline   stamp all present migrations as applied WITHOUT
 *                              running them — for a DB whose schema was built
 *                              by hand before this runner existed
 *
 * Reads DATABASE_URL from the environment (bun auto-loads .env). Standalone:
 * deliberately does NOT import $lib/server/db.ts, which depends on the SvelteKit
 * runtime ($env/dynamic/private) and won't resolve outside it.
 */
import postgres from 'postgres';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const NAME_RE = /^\d{4}_[a-z0-9_]+\.sql$/;

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set — see .env.example');
	process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

async function ensureTable() {
	await sql`
		create table if not exists schema_migrations (
			version    text primary key,
			applied_at timestamptz not null default now()
		)`;
}

async function appliedVersions(): Promise<Set<string>> {
	const rows = await sql<{ version: string }[]>`select version from schema_migrations`;
	return new Set(rows.map((r) => r.version));
}

async function listMigrations(): Promise<string[]> {
	const files = await readdir(MIGRATIONS_DIR);
	const valid = files.filter((f) => f.endsWith('.sql'));
	const bad = valid.filter((f) => !NAME_RE.test(f));
	if (bad.length) {
		throw new Error(`migration filenames must match NNNN_name.sql — offenders: ${bad.join(', ')}`);
	}
	return valid.sort();
}

async function runMigration(file: string) {
	const body = await Bun.file(join(MIGRATIONS_DIR, file)).text();
	const version = file.replace(/'/g, "''");
	// One simple-protocol string: begin → the migration → record it → commit.
	// Single connection, single transaction; a failing statement aborts the lot.
	const tx = `begin;\n${body}\ninsert into schema_migrations (version) values ('${version}');\ncommit;`;
	await sql.unsafe(tx).simple();
}

async function cmdStatus() {
	await ensureTable();
	const applied = await appliedVersions();
	const all = await listMigrations();
	console.log(`migrations in ${MIGRATIONS_DIR}:\n`);
	for (const f of all) {
		console.log(`  ${applied.has(f) ? '✓ applied' : '· pending'}  ${f}`);
	}
	const pending = all.filter((f) => !applied.has(f));
	console.log(`\n${all.length} total, ${applied.size} applied, ${pending.length} pending`);
}

async function cmdUp() {
	await ensureTable();
	const applied = await appliedVersions();
	const pending = (await listMigrations()).filter((f) => !applied.has(f));
	if (!pending.length) {
		console.log('up to date — no pending migrations');
		return;
	}
	console.log(`applying ${pending.length} migration(s):`);
	for (const f of pending) {
		process.stdout.write(`  ${f} ... `);
		await runMigration(f);
		console.log('ok');
	}
	console.log('done');
}

async function cmdBaseline() {
	await ensureTable();
	const applied = await appliedVersions();
	const toStamp = (await listMigrations()).filter((f) => !applied.has(f));
	if (!toStamp.length) {
		console.log('nothing to baseline — all present migrations already recorded');
		return;
	}
	console.log(`baselining (recording as applied WITHOUT running) ${toStamp.length} migration(s):`);
	for (const f of toStamp) {
		await sql`insert into schema_migrations (version) values (${f})`;
		console.log(`  stamped ${f}`);
	}
	console.log('done — these are now considered applied');
}

const cmd = process.argv[2] ?? 'up';
try {
	if (cmd === 'up') await cmdUp();
	else if (cmd === 'status') await cmdStatus();
	else if (cmd === 'baseline') await cmdBaseline();
	else {
		console.error(`unknown command: ${cmd}\nusage: bun run migrate [up|status|baseline]`);
		process.exit(1);
	}
} catch (err) {
	console.error('\nmigration failed:', err instanceof Error ? err.message : err);
	process.exit(1);
} finally {
	await sql.end();
}
