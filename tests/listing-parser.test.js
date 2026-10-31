'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseListing } = require('../listing-parser');

test('listing parser extracts rent only when monthly rent context is explicit', () => {
  assert.equal(parseListing('Aylıq icarə qiyməti: 1 500 AZN').monthlyRent, 1500);
  assert.equal(parseListing('Monthly rent: 2,000 AZN').monthlyRent, 2000);
  assert.equal(parseListing('1 250 AZN / ay').monthlyRent, 1250);
});

test('listing parser does not mistake sale price or unrelated prices for monthly rent', () => {
  assert.equal(parseListing('Satılır: 185 000 AZN. Sahə 90 m².').monthlyRent, null);
  assert.equal(parseListing('Qiymət 2 500 AZN. Təmirli obyekt.').monthlyRent, null);
});
