'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plans, effectivePlanKey, publicPlanInfo, planFromStripeSubscription, subscriptionPeriodEnd } = require('../plans');

test('all tiers expose explicit enforced limits', () => {
  assert.deepEqual(
    [plans.free.analyses, plans.pro.analyses, plans.business.analyses],
    [3, 50, 200]
  );
  assert.deepEqual(
    [plans.free.aiRequestsPerDay, plans.pro.aiRequestsPerDay, plans.business.aiRequestsPerDay],
    [5, 30, 100]
  );
  assert.deepEqual(
    [plans.free.maxRadiusMeters, plans.pro.maxRadiusMeters, plans.business.maxRadiusMeters],
    [500, 1200, 3000]
  );
  assert.deepEqual(
    [plans.free.locationComparisons, plans.pro.locationComparisons, plans.business.locationComparisons],
    [2, 6, 9]
  );
  assert.equal(plans.free.pdfExport, false);
  assert.equal(plans.pro.pdfExport, true);
  assert.equal(plans.business.pdfExport, true);
  assert.equal(plans.free.historyDays, 7);
  assert.equal(plans.pro.historyDays, 90);
  assert.equal(plans.business.historyDays, null);
});

test('paid access requires a recognised plan and a live subscription status', () => {
  assert.equal(effectivePlanKey({ plan: 'pro', subscription_status: 'active' }), 'pro');
  assert.equal(effectivePlanKey({ plan: 'business', subscription_status: 'trialing' }), 'business');
  assert.equal(effectivePlanKey({ plan: 'pro', subscriptionStatus: 'active' }), 'pro');
  assert.equal(effectivePlanKey({ plan: 'business', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: '2999-01-01T00:00:00Z' }), 'business');
  assert.equal(effectivePlanKey({ plan: 'pro', subscription_status: 'past_due' }), 'free');
  assert.equal(effectivePlanKey({ plan: 'business', subscription_status: 'canceled' }), 'free');
  assert.equal(effectivePlanKey({ plan: 'pro', subscription_status: 'active', subscription_current_period_end: '2000-01-01T00:00:00Z' }), 'free');
  assert.equal(effectivePlanKey({ plan: 'pro', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: 'invalid-date' }), 'free');
  assert.equal(effectivePlanKey({ plan: 'admin', subscription_status: 'active' }), 'free');
  assert.equal(effectivePlanKey(null), 'free');
});

test('Stripe subscription maps only the known paid tiers', () => {
  assert.equal(planFromStripeSubscription({ metadata: { plan: 'pro' } }), 'pro');
  assert.equal(planFromStripeSubscription({ metadata: { plan: 'pro' }, items: { data: [{ price: { id: 'price_unknown' } }] } }, { pro: 'price_pro' }), null);
  assert.equal(planFromStripeSubscription({ metadata: { plan: 'business' }, items: { data: [{ price: { id: 'price_pro' } }] } }, { pro: 'price_pro', business: 'price_business' }), 'pro');
  assert.equal(planFromStripeSubscription({ items: { data: [{ price: { id: 'price_business' } }] } }, { business: 'price_business' }), 'business');
  assert.equal(planFromStripeSubscription({ items: { data: [{ price: { id: 'price_unknown' } }] } }, { pro: 'price_pro' }), null);
  assert.equal(publicPlanInfo('unknown').name, 'Free');
});

test('Stripe billing period supports modern item-level and legacy subscription-level fields', () => {
  assert.equal(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1900000000 }] } }), 1900000000);
  assert.equal(subscriptionPeriodEnd({ current_period_end: 1800000000 }), 1800000000);
  assert.equal(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1900000000 }, { current_period_end: 1850000000 }] } }), 1850000000);
  assert.equal(subscriptionPeriodEnd({ items: { data: [{}] } }), null);
});
