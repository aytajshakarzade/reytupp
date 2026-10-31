'use strict';

const plans = Object.freeze({
  free: Object.freeze({
    name: 'Free', monthly: 0, analyses: 3, aiRequestsPerDay: 5,
    maxRadiusMeters: 500, historyDays: 7, locationComparisons: 2,
    teamMembers: 1, pdfExport: false, ai: true
  }),
  pro: Object.freeze({
    name: 'Professional', monthly: null, analyses: 50, aiRequestsPerDay: 30,
    maxRadiusMeters: 1200, historyDays: 90, locationComparisons: 6,
    teamMembers: 3, pdfExport: true, ai: true
  }),
  business: Object.freeze({
    name: 'Business', monthly: null, analyses: 200, aiRequestsPerDay: 100,
    maxRadiusMeters: 3000, historyDays: null, locationComparisons: 9,
    teamMembers: 10, pdfExport: true, ai: true
  })
});

function effectivePlanKey(user) {
  if (!user || !['pro', 'business'].includes(user.plan)) return 'free';
  const status = user.subscription_status ?? user.subscriptionStatus;
  const periodEnd = user.subscription_current_period_end ?? user.subscriptionCurrentPeriodEnd;
  if (!['active', 'trialing'].includes(String(status || '').toLowerCase())) return 'free';
  if (periodEnd) {
    const end = new Date(periodEnd).getTime();
    if (!Number.isFinite(end) || end <= Date.now()) return 'free';
  }
  return user.plan;
}

function publicPlanInfo(key) {
  const plan = plans[key] || plans.free;
  return { ...plan };
}

function planFromStripeSubscription(subscription, priceIds = {}) {
  // The configured Stripe Price ID is the source of truth. Metadata can be stale
  // after a customer changes plans, so it must never override a known Price ID.
  const ids = (subscription?.items?.data || [])
    .map(item => typeof item?.price === 'string' ? item.price : item?.price?.id)
    .filter(Boolean);
  for (const [plan, priceId] of Object.entries(priceIds)) {
    if (['pro', 'business'].includes(plan) && priceId && ids.includes(priceId)) return plan;
  }
  // Metadata is only a legacy fallback when no Price IDs are configured at all.
  // Once configured prices exist, an unknown/mismatched price must not grant access.
  const hasConfiguredPriceIds = Object.values(priceIds || {}).some(Boolean);
  const metadataPlan = String(subscription?.metadata?.plan || '').toLowerCase();
  if (!hasConfiguredPriceIds && ['pro', 'business'].includes(metadataPlan)) return metadataPlan;
  return null;
}

// Stripe API versions from 2025-03-31.basil onwards moved billing periods
// from Subscription to SubscriptionItem. Read both shapes for compatibility.
function subscriptionPeriodEnd(subscription) {
  const itemEnds = (subscription?.items?.data || [])
    .map(item => Number(item?.current_period_end))
    .filter(value => Number.isFinite(value) && value > 0);
  const topLevel = Number(subscription?.current_period_end);
  if (Number.isFinite(topLevel) && topLevel > 0) itemEnds.push(topLevel);
  return itemEnds.length ? Math.min(...itemEnds) : null;
}

module.exports = { plans, effectivePlanKey, publicPlanInfo, planFromStripeSubscription, subscriptionPeriodEnd };
