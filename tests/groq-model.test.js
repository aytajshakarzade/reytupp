'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveGroqModel } = require('../groq-model');

test('retired Groq model IDs are transparently mapped without editing .env', () => {
  assert.deepEqual(resolveGroqModel('llama-3.3-70b-versatile'), {
    configuredModel: 'llama-3.3-70b-versatile', model: 'openai/gpt-oss-120b', replaced: true
  });
});

test('an unspecified Groq model uses a current production default', () => {
  assert.equal(resolveGroqModel('').model, 'openai/gpt-oss-120b');
});

test('a configured supported/custom model is preserved', () => {
  assert.deepEqual(resolveGroqModel('openai/gpt-oss-120b'), {
    configuredModel: 'openai/gpt-oss-120b', model: 'openai/gpt-oss-120b', replaced: false
  });
});
