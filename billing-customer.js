'use strict';

/** Only reuse a Stripe customer that is not deleted and belongs to this account email. */
function isReusableStripeCustomer(customer, accountEmail) {
  if (!customer || customer.deleted === true || !customer.id) return false;
  const expected = String(accountEmail || '').trim().toLowerCase();
  const actual = String(customer.email || '').trim().toLowerCase();
  return Boolean(expected && actual && expected === actual);
}

module.exports = { isReusableStripeCustomer };
