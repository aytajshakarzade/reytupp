'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { postgresAdapter, postgresSql } = require('../database');
const { reserveAiRequestSql } = require('../usage-sql');

test('PostgreSQL adapter does not request a nonexistent id from usage tables', async () => {
  const calls = [];
  const fake = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [], rowCount: 1 }; } };
  const db = postgresAdapter(fake);

  await db.prepare('INSERT INTO analysis_usage(user_id,usage_month,request_count) VALUES(?,?,?) ON CONFLICT(user_id,usage_month) DO NOTHING').run(7, '2026-10-01', 0);
  await db.prepare('INSERT INTO assistant_usage(user_id,usage_date,request_count) VALUES(?,?,1) ON CONFLICT(user_id,usage_date) DO NOTHING').run(7, '2026-10-31');

  assert.equal(calls.length, 2);
  assert.doesNotMatch(calls[0].sql, /RETURNING\s+id/i);
  assert.doesNotMatch(calls[1].sql, /RETURNING\s+id/i);
  assert.deepEqual(calls[0].params, [7, '2026-10-01', 0]);
});

test('PostgreSQL adapter still returns generated ids from tables that have id columns', async () => {
  const calls = [];
  const fake = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: '42' }], rowCount: 1 }; } };
  const db = postgresAdapter(fake);
  const result = await db.prepare('INSERT INTO users(name,email) VALUES(?,?)').run('Test', 'test@example.test');
  assert.match(calls[0].sql, /RETURNING id$/i);
  assert.equal(result.lastInsertRowid, 42);
});

test('PostgreSQL AI usage upsert qualifies request_count to avoid ambiguous references', () => {
  const sql = postgresSql(reserveAiRequestSql('postgres'));
  assert.match(sql, /INSERT INTO assistant_usage AS au/i);
  assert.match(sql, /request_count=au\.request_count\+1/i);
  assert.match(sql, /WHERE au\.request_count < \$3/i);
  assert.match(sql, /RETURNING au\.request_count AS request_count/i);
  assert.doesNotMatch(sql, /WHERE request_count < \$3/i);
});

test('SQLite AI usage upsert remains SQLite-compatible', () => {
  const sql = reserveAiRequestSql('sqlite');
  assert.match(sql, /INSERT INTO assistant_usage\(/i);
  assert.match(sql, /WHERE request_count < \?/i);
  assert.doesNotMatch(sql, /\bau\./i);
});

test('PostgreSQL translates qualified request counter decrements correctly', () => {
  assert.equal(
    postgresSql('UPDATE assistant_usage SET request_count=MAX(0,assistant_usage.request_count-1) WHERE user_id=?'),
    'UPDATE assistant_usage SET request_count=GREATEST(0, assistant_usage.request_count - 1) WHERE user_id=$1'
  );
});


test('Stripe persistence SELECTs quote camelCase aliases for PostgreSQL', async () => {
  const calls = [];
  const fake = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ stripeCustomerId: 'cus_123', stripeSubscriptionId: 'sub_123', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: null }], rowCount: 1 }; } };
  const db = postgresAdapter(fake);
  const row = await db.prepare('SELECT stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId", subscription_status AS "subscriptionStatus", subscription_current_period_end AS "subscriptionCurrentPeriodEnd" FROM users WHERE id=?').get(5);
  assert.equal(row.stripeCustomerId, 'cus_123');
  assert.equal(row.stripeSubscriptionId, 'sub_123');
  assert.equal(row.subscriptionStatus, 'active');
  assert.match(calls[0].sql, /AS "stripeCustomerId"/);
});
