'use strict';

// Keep legacy .env values working without editing the user's .env file.
// Groq retired llama-3.3-70b-versatile on 2026-08-16; GPT-OSS 120B is
// listed as a production model in Groq's current supported-model catalogue.
const MODEL_REPLACEMENTS = Object.freeze({
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b'
});

function resolveGroqModel(configuredModel) {
  const requested = String(configuredModel || '').trim();
  if (!requested) return { configuredModel: null, model: 'openai/gpt-oss-120b', replaced: false };
  const replacement = MODEL_REPLACEMENTS[requested];
  return {
    configuredModel: requested,
    model: replacement || requested,
    replaced: Boolean(replacement)
  };
}

module.exports = { resolveGroqModel, MODEL_REPLACEMENTS };
