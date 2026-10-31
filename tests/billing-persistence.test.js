'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { syncSubscriptionForUser } = require('../billing-persistence');

function makeFakeDb(initialUser) {
  const user = { ...initialUser };
  return {
    user,
    prepare(sql) {
      if (/SELECT id,stripe_customer_id AS "?stripeCustomerId"? FROM users/i.test(sql)) {
        return { get: async () => ({ id: user.id, stripeCustomerId: user.stripe_customer_id }) };
      }
      if (/UPDATE users SET plan=COALESCE\(\?,plan\),stripe_customer_id=\?/i.test(sql)) {
        return { run: async (plan, customerId, subscriptionId, status, periodEnd, userId) => {
          assert.equal(Number(userId), Number(user.id));
          if (plan !== null && plan !== undefined) user.plan = plan;
          user.stripe_customer_id = customerId;
          user.stripe_subscription_id = subscriptionId;
          user.subscription_status = status;
          user.subscription_current_period_end = periodEnd;
          return { changes: 1 };
        } };
      }
      if (/SELECT id,name,email,plan,role,stripe_customer_id AS "?stripeCustomerId"?/i.test(sql)) {
        return { get: async () => ({
          id: user.id, name: user.name, email: user.email, plan: user.plan, role: user.role,
          stripeCustomerId: user.stripe_customer_id, stripeSubscriptionId: user.stripe_subscription_id,
          subscriptionStatus: user.subscription_status,
          subscriptionCurrentPeriodEnd: user.subscription_current_period_end
        }) };
      }
      throw new Error(`Unexpected SQL in fake DB: ${sql}`);
    }
  };
}

test('verified Checkout replaces a stale Stripe customer ID and persists the paid plan', async () => {
  const db = makeFakeDb({
    id: 8, name: 'Test', email: 'test@example.test', plan: 'free', role: 'user',
    stripe_customer_id: 'cus_old', stripe_subscription_id: null,
    subscription_status: 'inactive', subscription_current_period_end: null
  });
  const subscription = {
    id: 'sub_new', customer: 'cus_new', status: 'active',
    items: { data: [{ current_period_end: 1_900_000_000, price: { id: 'price_pro' } }] }
  };

  const persisted = await syncSubscriptionForUser(
    db, 8, subscription, { pro: 'price_pro' }, 'pro',
    { trustedCheckout: true, confirmedPlan: 'pro' }
  );

  assert.equal(persisted.plan, 'pro');
  assert.equal(persisted.stripeCustomerId, 'cus_new');
  assert.equal(persisted.stripeSubscriptionId, 'sub_new');
  assert.equal(persisted.subscriptionStatus, 'active');
});

test('ordinary subscription refresh cannot overwrite a mismatched Stripe customer', async () => {
  const db = makeFakeDb({
    id: 9, name: 'Test', email: 'test2@example.test', plan: 'free', role: 'user',
    stripe_customer_id: 'cus_owned', stripe_subscription_id: null,
    subscription_status: 'inactive', subscription_current_period_end: null
  });
  await assert.rejects(() => syncSubscriptionForUser(
    db, 9, { id: 'sub_other', customer: 'cus_other', status: 'active' },
    { pro: 'price_pro' }, null, {}
  ), /does not match/);
});


test('verified Checkout session customer ID is persisted when subscription omits customer', async () => {
  const db = makeFakeDb({
    id: 10, name: 'Test', email: 'test3@example.test', plan: 'free', role: 'user',
    stripe_customer_id: 'cus_old', stripe_subscription_id: null,
    subscription_status: 'inactive', subscription_current_period_end: null
  });
  const subscription = {
    id: 'sub_session_customer', status: 'active',
    items: { data: [{ current_period_end: 1_900_000_000, price: { id: 'price_pro' } }] }
  };
  const persisted = await syncSubscriptionForUser(
    db, 10, subscription, { pro: 'price_pro' }, 'pro',
    { trustedCheckout: true, confirmedPlan: 'pro', customerId: 'cus_from_checkout_session' }
  );
  assert.equal(persisted.plan, 'pro');
  assert.equal(persisted.stripeCustomerId, 'cus_from_checkout_session');
  assert.equal(persisted.stripeSubscriptionId, 'sub_session_customer');
});

test('verified Checkout refuses conflicting session and subscription customer IDs', async () => {
  const db = makeFakeDb({
    id: 11, name: 'Test', email: 'test4@example.test', plan: 'free', role: 'user',
    stripe_customer_id: null, stripe_subscription_id: null,
    subscription_status: 'inactive', subscription_current_period_end: null
  });
  await assert.rejects(() => syncSubscriptionForUser(
    db, 11, { id: 'sub_conflict', customer: 'cus_from_subscription', status: 'active' },
    { pro: 'price_pro' }, 'pro',
    { trustedCheckout: true, confirmedPlan: 'pro', customerId: 'cus_from_session' }
  ), /does not match/);
});
