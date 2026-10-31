'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function sqliteAdapter(native) {
  const adapter = {
    mode: 'sqlite',
    prepare(sql) {
      const statement = native.prepare(sql);
      return {
        get: async (...params) => statement.get(...params),
        all: async (...params) => statement.all(...params),
        run: async (...params) => statement.run(...params)
      };
    },
    async exec(sql) { return native.exec(sql); },
    async transaction(work) {
      native.exec('BEGIN IMMEDIATE');
      try {
        const value = await work(adapter);
        native.exec('COMMIT');
        return value;
      } catch (error) {
        try { native.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },
    async close() { native.close(); }
  };
  return adapter;
}

function postgresSql(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/date\('now','start of month'\)/gi, "date_trunc('month', CURRENT_TIMESTAMP)")
    .replace(/MAX\(0\s*,\s*((?:[a-z_][a-z0-9_]*\.)?request_count)\s*-\s*1\)/gi, (_match, column) => `GREATEST(0, ${column} - 1)`);
}

// These runtime tables intentionally use composite/user keys and have no `id` column.
// Do not append `RETURNING id` to their INSERT statements in the PostgreSQL adapter.
const POSTGRES_TABLES_WITHOUT_ID = new Set(['assistant_usage', 'analysis_usage', 'user_preferences']);

function postgresAdapter(queryable, pool = null) {
  const adapter = {
    mode: 'postgres',
    prepare(sql) {
      return {
        async get(...params) {
          const result = await queryable.query(postgresSql(sql), params);
          return result.rows[0];
        },
        async all(...params) {
          const result = await queryable.query(postgresSql(sql), params);
          return result.rows;
        },
        async run(...params) {
          let statement = postgresSql(sql).trim().replace(/;$/, '');
          if (/^INSERT\s/i.test(statement) && !/\bRETURNING\b/i.test(statement)) {
            const tableMatch = statement.match(/^INSERT\s+INTO\s+([a-z_][a-z0-9_]*|\"[^\"]+\")/i);
            const tableName = tableMatch?.[1]?.replaceAll('\"', '').split('.').pop().toLowerCase();
            if (tableName && !POSTGRES_TABLES_WITHOUT_ID.has(tableName)) statement += ' RETURNING id';
          }
          const result = await queryable.query(statement, params);
          const returnedId = result.rows?.[0]?.id;
          return {
            lastInsertRowid: returnedId === undefined ? undefined : Number(returnedId),
            changes: result.rowCount || 0
          };
        }
      };
    },
    async exec(sql) { return queryable.query(sql); },
    async transaction(work) {
      if (!pool) throw new Error('Nested PostgreSQL transaction is not supported.');
      const client = await pool.connect();
      const tx = postgresAdapter(client);
      try {
        await client.query('BEGIN');
        const value = await work(tx);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }
    },
    async close() { if (pool) await pool.end(); }
  };
  return adapter;
}

function initSqlite(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const native = new DatabaseSync(filePath);
  native.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  role TEXT NOT NULL DEFAULT 'user',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  subscription_current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  business_type TEXT NOT NULL,
  listing_url TEXT NOT NULL,
  address TEXT,
  monthly_rent REAL,
  monthly_revenue REAL,
  initial_investment REAL,
  source_title TEXT,
  source_description TEXT,
  latitude REAL,
  longitude REAL,
  result_json TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  custom_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_user_favorite ON analyses(user_id, is_favorite);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE TABLE IF NOT EXISTS billing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_event_id TEXT UNIQUE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assistant_usage (
  user_id INTEGER NOT NULL,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS analysis_usage (
  user_id INTEGER NOT NULL,
  usage_month TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_month),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workspace_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER NOT NULL PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'az',
  theme TEXT NOT NULL DEFAULT 'dark',
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expires ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_tokens_expires ON password_reset_tokens(expires_at);
`);

  // Keep legacy SQLite installations compatible.
  const userColumns = new Set(native.prepare('PRAGMA table_info(users)').all().map(row => row.name));
  for (const [name, definition] of [
    ['stripe_customer_id', 'TEXT'], ['stripe_subscription_id', 'TEXT'],
    ['subscription_status', "TEXT NOT NULL DEFAULT 'inactive'"], ['subscription_current_period_end', 'TEXT']
  ]) if (!userColumns.has(name)) native.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  const analysisColumns = new Set(native.prepare('PRAGMA table_info(analyses)').all().map(row => row.name));
  for (const [name, definition] of [['is_favorite', 'INTEGER NOT NULL DEFAULT 0'], ['custom_name', 'TEXT']]) {
    if (!analysisColumns.has(name)) native.exec(`ALTER TABLE analyses ADD COLUMN ${name} ${definition}`);
  }
  return sqliteAdapter(native);
}

async function initPostgres(connectionString) {
  let parsedConnection;
  try { parsedConnection = new URL(connectionString); } catch { throw new Error('DATABASE_URL formatı yanlışdır. Supabase Connect bölməsindən PostgreSQL URI-ni olduğu kimi götürün.'); }
  if (!parsedConnection.hostname || parsedConnection.hostname === 'host' || parsedConnection.hostname.includes('<')) {
    throw new Error('DATABASE_URL hələ nümunə/placeholder dəyəridir. Supabase → Connect → Session pooler bölməsindən real PostgreSQL connection string əlavə edin.');
  }
  let pg;
  try { pg = require('pg'); }
  catch { throw new Error('PostgreSQL driver "pg" is missing. Run npm install and redeploy.'); }
  pg.types.setTypeParser(20, value => Number(value)); // BIGINT -> safe JS number for app IDs
  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 12_000
  });
  try {
    await pool.query('SELECT 1');
    const migrationPath = path.join(__dirname, 'migrations', '002_supabase_runtime.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migration);
    const check = await pool.query(`SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='users' AND column_name='id'`);
    if (check.rows[0] && !['bigint', 'integer'].includes(check.rows[0].data_type)) {
      throw new Error('Supabase-də əvvəlki 001_initial.sql UUID sxemi tapıldı. Mövcud məlumatları silmədən avtomatik çevirmək təhlükəsiz deyil; yeni boş Supabase database/schema istifadə edin və 002 miqrasiyasını tətbiq edin.');
    }
    return postgresAdapter(pool, pool);
  } catch (error) {
    await pool.end().catch(() => {});
    if (/password authentication failed|ENOTFOUND|ECONNREFUSED|timeout|Tenant or user not found/i.test(error.message)) {
      throw new Error(`Supabase PostgreSQL bağlantısı qurulmadı: ${error.message}. DATABASE_URL dəyərini Supabase Connect bölməsindən yoxlayın.`);
    }
    throw error;
  }
}

async function createDatabase({ databaseUrl, sqliteFile }) {
  if (databaseUrl && databaseUrl.trim()) return initPostgres(databaseUrl.trim());
  return initSqlite(sqliteFile);
}

module.exports = { createDatabase, postgresSql, postgresAdapter };
