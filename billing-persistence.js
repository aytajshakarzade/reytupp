'use strict';

const { planFromStripeSubscription, subscriptionPeriodEnd } = require('./plans');

/**
 * Persist a Stripe subscription for a ReytUp user.
 * A verified Checkout confirmation is allowed to replace a stale customer ID;
 * ordinary subscription refreshes may not overwrite an existing customer link.
 */
async function syncSubscriptionForUser(db, userId, subscription, priceIds = {}, fallbackPlan = null, options = {}) {
  if (!userId || !subscription?.id) return null;

  const user = await db.prepare(
    'SELECT id,stripe_customer_id AS "stripeCustomerId" FROM users WHERE id=?'
  ).get(userId);
  if (!user) return null;

  const subscriptionCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;
  const checkoutCustomerId = String(options.customerId || '').trim() || null;

  // A server-verified Checkout Session is authoritative for its customer ID.
  // When Stripe includes customer on the Subscription as well, both IDs must agree.
  if (options.trustedCheckout && checkoutCustomerId && subscriptionCustomerId && checkoutCustomerId !== subscriptionCustomerId) {
    throw new Error('Verified Checkout customer does not match the Stripe subscription customer.');
  }
  const customerId = checkoutCustomerId || subscriptionCustomerId || null;

  if (user.stripeCustomerId && customerId && user.stripeCustomerId !== customerId && !options.trustedCheckout) {
    throw new Error('Stripe customer does not match the authenticated user.');
  }

  const planKey = options.confirmedPlan || planFromStripeSubscription(subscription, priceIds);
  const status = String(subscription.status || 'inactive').toLowerCase();
  const active = ['active', 'trialing'].includes(status);
  const allowedFallback = ['pro', 'business'].includes(String(fallbackPlan || '').toLowerCase())
    ? String(fallbackPlan).toLowerCase()
    : null;
  const selectedPlan = active
    ? (planKey || allowedFallback)
    : ['canceled', 'unpaid', 'incomplete_expired'].includes(status) ? 'free' : null;

  const periodEnd = subscriptionPeriodEnd(subscription);
  const end = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const nextCustomerId = options.trustedCheckout
    ? (checkoutCustomerId || customerId || user.stripeCustomerId || null)
    : (user.stripeCustomerId || customerId || null);

  const update = await db.prepare(`UPDATE users SET plan=COALESCE(?,plan),stripe_customer_id=?,
    stripe_subscription_id=?,subscription_status=?,subscription_current_period_end=? WHERE id=?`)
    .run(selectedPlan, nextCustomerId, subscription.id, status, end, userId);
  if (update && Number(update.changes) === 0) {
    throw new Error('Verified Stripe subscription could not update the account row.');
  }

  const saved = await db.prepare(`SELECT id,name,email,plan,role,stripe_customer_id AS "stripeCustomerId",
    stripe_subscription_id AS "stripeSubscriptionId",subscription_status AS "subscriptionStatus",
    subscription_current_period_end AS "subscriptionCurrentPeriodEnd",created_at AS "createdAt"
    FROM users WHERE id=?`).get(userId);
  if (!saved) throw new Error('Account row was not found after Stripe subscription persistence.');
  if (selectedPlan && String(saved.plan || '').toLowerCase() !== selectedPlan) {
    throw new Error('Stored subscription tier does not match the verified Stripe Price ID.');
  }
  if (nextCustomerId && saved.stripeCustomerId !== nextCustomerId) {
    throw new Error('Stored Stripe customer ID does not match the verified Checkout session.');
  }
  if (saved.stripeSubscriptionId !== subscription.id) {
    throw new Error('Stored Stripe subscription ID does not match the verified subscription.');
  }
  if (saved.subscriptionStatus !== status) {
    throw new Error('Stored subscription status does not match Stripe.');
  }
  return saved;
}

module.exports = { syncSubscriptionForUser };
