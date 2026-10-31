'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const crypto = require('node:crypto');
const { createServer } = require('node:net');
const { DatabaseSync } = require('node:sqlite');
const { createDatabase, postgresSql } = require('../database');
const { isPlaceholderDatabaseUrl, isSupabaseDatabaseUrl } = require('../start');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
let child;
let baseUrl;
let tempDir;
let authToken;
let formspreeMock;
let lastFormspreeSubmission;

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url, processRef) {
  const until = Date.now() + 10_000;
  let lastError;
  while (Date.now() < until) {
    if (processRef.exitCode !== null) throw new Error(`Server exited early (${processRef.exitCode})`);
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return await response.json();
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become healthy: ${lastError?.message || 'timeout'}`);
}

async function request(route, options = {}) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, payload };
}

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reytup-smoke-'));
  const formspreePort = await freePort();
  formspreeMock = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    lastFormspreeSubmission = new URLSearchParams(raw);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise(resolve => formspreeMock.listen(formspreePort, '127.0.0.1', resolve));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  // Start from a v3-style users table to prove startup migrations are backward compatible.
  const legacyDb = new DatabaseSync(path.join(tempDir, 'reytup-test.db'));
  legacyDb.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  legacyDb.close();
  child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      APP_ORIGIN: baseUrl,
      FORMSPREE_ENDPOINT: `http://127.0.0.1:${formspreePort}/f/test-form`,
      DB_FILE: path.join(tempDir, 'reytup-test.db'),
      DATABASE_URL: '',
      JWT_SECRET: 'smoke-test-secret-not-for-production-0123456789-abcdefghijklmnopqrstuvwxyz',
      ADMIN_EMAIL: '',
      GROQ_API_KEY: '',
      GOOGLE_PLACES_API_KEY: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: 'whsec_smoke_test_secret',
      STRIPE_PRICE_PRO: '',
      STRIPE_PRICE_BUSINESS: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  const health = await waitForServer(baseUrl, child);
  assert.equal(health.version, '4.2');
});

after(async () => {
  if (formspreeMock) await new Promise(resolve => formspreeMock.close(resolve));
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1_500);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

test('health and static app assets are served', async () => {
  const { response, payload } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.database, 'sqlite');
  assert.equal(payload.integrations.openStreetMap, true);
  assert.equal(payload.integrations.groq, false);

  const page = await request('/dashboard.html');
  assert.equal(page.response.status, 200);
  assert.match(page.payload, /dashboard-app-shell/);
  assert.match(page.payload, /reytup-signal\.css/);
  assert.match(page.payload, /assistant\.js/);
  assert.match(page.payload, /billing-recover-button/);

  const pricing = await request('/pricing.html');
  assert.equal(pricing.response.status, 200);
  assert.match(pricing.payload, /workspace-shell\.js/);
  assert.match(pricing.payload, /workspace-shell\.css/);
  assert.doesNotMatch(pricing.payload, /target="_blank"[^>]*dashboard-nav-link/);

  const shellCss = await request('/workspace-shell.css');
  assert.equal(shellCss.response.status, 200);
  assert.match(shellCss.payload, /body\.workspace-page/);

  const shell = await request('/workspace-shell.js');
  assert.equal(shell.response.status, 200);
  assert.match(shell.payload, /workspace-sidebar/);

  const css = await request('/reytup-signal.css');
  assert.equal(css.response.status, 200);
  assert.match(css.payload, /--signal-lime/);
});

test('premium dashboard and analysis detail assets are served', async () => {
  const dashboard = await fetch(`${baseUrl}/dashboard.html`);
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /premium-dashboard\.css/);
  assert.match(dashboardHtml, /dashboard-score-chart/);
  assert.match(dashboardHtml, /dashboard-source-health/);
  assert.match(dashboardHtml, /decision-passport-card/);
  assert.match(dashboardHtml, /passport-copy/);
  assert.match(dashboardHtml, /reytup-experience\.css/);
  const styles = await fetch(`${baseUrl}/premium-dashboard.css`);
  assert.equal(styles.status, 200);
  assert.match(await styles.text(), /dash-chart-bars/);
  const experience = await fetch(`${baseUrl}/reytup-experience.css`);
  assert.equal(experience.status, 200);
  const experienceCss = await experience.text();
  assert.match(experienceCss, /--reytup-sidebar-width/);
  assert.match(experienceCss, /passport-score-ring/);
});

test('registration, authenticated account context and private analysis list work', async () => {
  const signup = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke User', email: 'smoke@example.test', password: 'safe-pass-12345' })
  });
  assert.equal(signup.response.status, 201);
  assert.ok(signup.payload.token);
  authToken = signup.payload.token;
  assert.equal(signup.payload.user.plan, 'free');

  const me = await request('/api/auth/me');
  assert.equal(me.response.status, 200);
  assert.equal(me.payload.user.email, 'smoke@example.test');
  assert.equal(me.payload.user.plan, 'free');
  assert.equal(me.payload.user.planInfo.analyses, 3);
  assert.equal(me.payload.user.planInfo.aiRequestsPerDay, 5);
  assert.equal(me.payload.user.usage.analysesLimit, 3);
  assert.equal(me.payload.user.usage.aiLimitPerDay, 5);

  const migrated = new DatabaseSync(path.join(tempDir, 'reytup-test.db'));
  const columns = new Set(migrated.prepare('PRAGMA table_info(users)').all().map(row => row.name));
  assert.ok(columns.has('stripe_customer_id'));
  assert.ok(columns.has('stripe_subscription_id'));
  assert.ok(columns.has('subscription_status'));
  assert.ok(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assistant_usage'").get());
  assert.ok(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='analysis_usage'").get());
  migrated.close();

  const context = await request('/api/assistant/context');
  assert.equal(context.response.status, 200);
  assert.equal(context.payload.aiConfigured, false);
  assert.equal(context.payload.latestAnalysis, null);

  const billingStatus = await request('/api/billing/status');
  assert.equal(billingStatus.response.status, 200);
  assert.equal(billingStatus.payload.plan, 'free');
  assert.equal(billingStatus.payload.storedPlan, 'free');

  const recoveryWithoutStripe = await request('/api/billing/recover', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(recoveryWithoutStripe.response.status, 503);
  assert.equal(recoveryWithoutStripe.payload.code, 'BILLING_NOT_CONFIGURED');

  const analyses = await request('/api/analyses');
  assert.equal(analyses.response.status, 200);
  assert.deepEqual(analyses.payload.items, []);
  assert.equal(analyses.payload.totalCount, 0);
  assert.equal(analyses.payload.thisMonthCount, 0);

  // Execute the exact analysis INSERT from server.js to prevent the 14-column / 15-value regression.
  const serverSource = fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf8');
  const insertMatch = serverSource.match(/db\.prepare\(`(INSERT INTO analyses[\s\S]*?)`\)\.run/);
  assert.ok(insertMatch, 'analysis INSERT statement must exist');
  const insertDb = new DatabaseSync(path.join(tempDir, 'reytup-test.db'));
  const inserted = insertDb.prepare(insertMatch[1]).run(
    signup.payload.user.id, 'cafe', '', 'Fəvvarələr meydanı, Bakı', 2500, 15000, 35000,
    null, null, 40.3725, 49.8450, JSON.stringify({ score: 76 })
  );
  assert.ok(inserted.lastInsertRowid);
  insertDb.close();
  const savedAnalyses = await request('/api/analyses');
  assert.equal(savedAnalyses.response.status, 200);
  assert.equal(savedAnalyses.payload.totalCount, 1);
  assert.equal(savedAnalyses.payload.items[0].result.score, 76);
  const freePdf = await request(`/api/analyses/${savedAnalyses.payload.items[0].id}/pdf`);
  assert.equal(freePdf.response.status, 403);
  assert.equal(freePdf.payload.code, 'PLAN_FEATURE_REQUIRED');
});

test('Stripe webhook validates signatures, repairs stale customer links, activates only the paid tier, and is idempotent', async () => {
  const secret = 'whsec_smoke_test_secret';
  async function deliver(event) {
    const raw = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
    return fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body: raw
    });
  }

  const testUserId = Number(JSON.parse(Buffer.from(authToken.split('.')[1], 'base64url').toString()).sub);
  const staleCustomerDb = new DatabaseSync(path.join(tempDir, 'reytup-test.db'));
  staleCustomerDb.prepare('UPDATE users SET stripe_customer_id=? WHERE id=?').run('cus_stale_from_old_checkout', testUserId);
  staleCustomerDb.close();

  const completed = {
    id: 'evt_smoke_checkout_complete', type: 'checkout.session.completed', created: Math.floor(Date.now()/1000),
    data: { object: {
      id: 'cs_test_smoke', status: 'complete', payment_status: 'paid',
      client_reference_id: String(JSON.parse(Buffer.from(authToken.split('.')[1], 'base64url').toString()).sub),
      customer: 'cus_smoke', subscription: 'sub_smoke',
      metadata: {
        user_id: String(JSON.parse(Buffer.from(authToken.split('.')[1], 'base64url').toString()).sub),
        plan: 'pro'
      }
    } }
  };
  const first = await deliver(completed);
  assert.equal(first.status, 200);
  // Checkout metadata links the customer/subscription, but does not grant a paid tier by itself.
  const checkoutLinked = await request('/api/auth/me');
  assert.equal(checkoutLinked.payload.user.plan, 'free');
  assert.equal(checkoutLinked.payload.user.stripeCustomerId, 'cus_smoke');

  const subscriptionCreated = {
    id: 'evt_smoke_subscription_created', type: 'customer.subscription.created', created: Math.floor(Date.now()/1000),
    data: { object: {
      id: 'sub_smoke', customer: 'cus_smoke', status: 'active',
      metadata: completed.data.object.metadata,
      items: { data: [] }
    } }
  };
  const subscriptionCreatedResponse = await deliver(subscriptionCreated);
  assert.equal(subscriptionCreatedResponse.status, 200);
  const activated = await request('/api/auth/me');
  assert.equal(activated.payload.user.plan, 'pro');
  assert.equal(activated.payload.user.planInfo.analyses, 50);
  assert.equal(activated.payload.user.usage.analysesLimit, 50);
  assert.equal(activated.payload.user.usage.aiLimitPerDay, 30);
  assert.equal(activated.payload.user.subscription.status, 'active');

  const duplicate = await deliver(completed);
  assert.equal(duplicate.status, 204);

  const canceled = {
    id: 'evt_smoke_subscription_canceled', type: 'customer.subscription.deleted', created: Math.floor(Date.now()/1000),
    data: { object: { id: 'sub_smoke', customer: 'cus_smoke', status: 'canceled', metadata: completed.data.object.metadata } }
  };
  const canceledResponse = await deliver(canceled);
  assert.equal(canceledResponse.status, 200);
  const downgraded = await request('/api/auth/me');
  assert.equal(downgraded.payload.user.plan, 'free');
  assert.equal(downgraded.payload.user.subscription.active, false);

  // A late invoice.paid event must not revive a subscription already marked canceled.
  const lateInvoicePaid = {
    id: 'evt_smoke_late_invoice_paid', type: 'invoice.paid', created: Math.floor(Date.now()/1000),
    data: { object: { id: 'in_smoke', subscription: 'sub_smoke' } }
  };
  const lateInvoiceResponse = await deliver(lateInvoicePaid);
  assert.equal(lateInvoiceResponse.status, 200);
  const stillCanceled = await request('/api/auth/me');
  assert.equal(stillCanceled.payload.user.plan, 'free');
  assert.equal(stillCanceled.payload.user.subscription.status, 'canceled');
});

test('optional integrations fail with explicit setup errors, not crashes', async () => {
  const ai = await request('/api/assistant/chat', {
    method: 'POST', body: JSON.stringify({ question: 'Bu analiz nə deməkdir?', language: 'az' })
  });
  assert.equal(ai.response.status, 503);
  assert.equal(ai.payload.code, 'AI_NOT_CONFIGURED');
  const aiStatus = await request('/api/assistant/status');
  assert.equal(aiStatus.response.status, 503);
  assert.equal(aiStatus.payload.code, 'AI_NOT_CONFIGURED');

  const plansResponse = await request('/api/billing/plans');
  assert.equal(plansResponse.response.status, 200);
  assert.equal(plansResponse.payload.plans.free.analyses, 3);
  assert.equal(plansResponse.payload.plans.pro.analyses, 50);
  assert.equal(plansResponse.payload.plans.business.analyses, 200);
  assert.equal(plansResponse.payload.plans.pro.configured, false);

  const checkout = await request('/api/billing/checkout', {
    method: 'POST', body: JSON.stringify({ plan: 'pro' })
  });
  assert.equal(checkout.response.status, 503);
  assert.equal(checkout.payload.code, 'BILLING_NOT_CONFIGURED');
});


test('contact form posts server-side to Formspree and archives only accepted submissions', async () => {
  const result = await request('/api/contact', {
    method: 'POST',
    body: JSON.stringify({ name: 'ReytUp Test', email: 'visitor@example.com', company: 'Demo LLC', message: 'Salam, bu test müraciətidir.' })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.ok, true);
  assert.equal(lastFormspreeSubmission.get('name'), 'ReytUp Test');
  assert.equal(lastFormspreeSubmission.get('email'), 'visitor@example.com');
  assert.equal(lastFormspreeSubmission.get('company'), 'Demo LLC');
  assert.equal(lastFormspreeSubmission.get('message'), 'Salam, bu test müraciətidir.');
  assert.equal(lastFormspreeSubmission.get('_replyto'), 'visitor@example.com');
});

test('protected endpoints reject unauthenticated requests', async () => {
  const saved = authToken;
  authToken = '';
  try {
    const result = await request('/api/analyses');
    assert.equal(result.response.status, 401);
  } finally { authToken = saved; }
});


test('PostgreSQL adapter translates SQLite placeholders and rejects placeholder DATABASE_URL', async () => {
  assert.equal(postgresSql("SELECT * FROM x WHERE a=? AND b=? AND created_at >= date('now','start of month')"),
    "SELECT * FROM x WHERE a=$1 AND b=$2 AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)");
  assert.equal(postgresSql('UPDATE assistant_usage SET request_count=MAX(0,request_count-1) WHERE user_id=?'),
    'UPDATE assistant_usage SET request_count=GREATEST(0, request_count - 1) WHERE user_id=$1');
  await assert.rejects(
    createDatabase({ databaseUrl: 'postgresql://user:password@host:5432/reytup', sqliteFile: path.join(os.tmpdir(), 'unused.db') }),
    /placeholder/
  );
});


test('Windows launcher detects any Supabase URL and securely re-prompts for database password', () => {
  assert.equal(isSupabaseDatabaseUrl('postgresql://postgres.project:old@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'), true);
  assert.equal(isSupabaseDatabaseUrl('postgresql://postgres:old@db.project.supabase.co:5432/postgres'), true);
  assert.equal(isSupabaseDatabaseUrl('postgresql://user:pass@db.example.com:5432/app'), false);
  assert.equal(isSupabaseDatabaseUrl('not-a-url'), false);
  assert.equal(isPlaceholderDatabaseUrl('postgresql://user:password@host:5432/reytup'), true);
  assert.equal(isPlaceholderDatabaseUrl('postgresql://postgres.project:real@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'), false);
});
