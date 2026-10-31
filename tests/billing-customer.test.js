'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isReusableStripeCustomer } = require('../billing-customer');

test('reuses only an active Stripe customer that matches the account email', () => {
  assert.equal(isReusableStripeCustomer({ id:'cus_1', email:'person@example.com' }, 'person@example.com'), true);
  assert.equal(isReusableStripeCustomer({ id:'cus_1', email:'other@example.com' }, 'person@example.com'), false);
  assert.equal(isReusableStripeCustomer({ id:'cus_1', email:'person@example.com', deleted:true }, 'person@example.com'), false);
  assert.equal(isReusableStripeCustomer({ id:'cus_1' }, 'person@example.com'), false);
  assert.equal(isReusableStripeCustomer(null, 'person@example.com'), false);
});
