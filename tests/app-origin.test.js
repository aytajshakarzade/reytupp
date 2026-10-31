'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAppOrigin, isLoopbackOrigin } = require('../app-origin');

test('Render public URL overrides a localhost APP_ORIGIN accidentally carried into production', () => {
  assert.equal(resolveAppOrigin({ appOrigin: 'http://localhost:4173', renderExternalUrl: 'https://reytup-example.onrender.com/' }), 'https://reytup-example.onrender.com');
});

test('explicit non-local custom domain takes precedence over Render default domain', () => {
  assert.equal(resolveAppOrigin({ appOrigin: 'https://app.example.com/', renderExternalUrl: 'https://service.onrender.com' }), 'https://app.example.com');
});

test('local development remains on localhost when no Render URL is present', () => {
  assert.equal(resolveAppOrigin({ appOrigin: 'http://localhost:4173', port: 4173 }), 'http://localhost:4173');
  assert.equal(resolveAppOrigin({ port: 4173 }), 'http://localhost:4173');
});

test('loopback detection is limited to local hostnames', () => {
  assert.equal(isLoopbackOrigin('http://127.0.0.1:4173'), true);
  assert.equal(isLoopbackOrigin('https://app.example.com'), false);
});
