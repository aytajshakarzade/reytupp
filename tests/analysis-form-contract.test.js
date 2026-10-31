'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/analyze.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'public/analyze.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('analysis form keeps rent budget and actual monthly rent as distinct fields', () => {
  assert.equal((html.match(/name="rentBudget"/g) || []).length, 1);
  assert.equal((html.match(/name="monthlyRent"/g) || []).length, 1);
  assert.match(client, /rentBudget:\s*f\.get\('rentBudget'\)/);
  assert.match(client, /monthlyRent:\s*f\.get\('monthlyRent'\)/);
  assert.match(server, /rentBudget:\s*money\(b\.rentBudget\)/);
  assert.match(server, /monthlyRent:\s*money\(b\.monthlyRent\)/);
});

test('physical property inputs are collected and carried into analysis', () => {
  const fields = {
    physicalArea: 'areaSqm',
    physicalFloor: 'floorLevel',
    physicalWindow: 'displayWindow',
    physicalEntrance: 'entranceType',
    physicalVentilation: 'ventilation'
  };
  for (const [formName, payloadName] of Object.entries(fields)) {
    assert.match(html, new RegExp(`name="${formName}"`));
    assert.match(client, new RegExp(`${payloadName}:\\s*f\\.get\\('${formName}'\\)`));
  }
  assert.match(server, /physical:\s*\{/);
  assert.match(server, /areaSqm:\s*b\.physical\?\.areaSqm/);
});

test('opportunity search does not treat the rent budget as actual rent', () => {
  assert.match(server, /rentBudget:\s*budget,\s*monthlyRent:\s*null/);
});
