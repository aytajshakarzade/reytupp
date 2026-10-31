'use strict';

function isLoopbackOrigin(value) {
  try {
    const host = new URL(String(value)).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Prefer an explicitly configured public origin. If APP_ORIGIN was accidentally
 * left at localhost on Render, use Render's injected public service URL instead.
 * Local development continues to use localhost when no Render URL exists.
 */
function resolveAppOrigin({ appOrigin = '', renderExternalUrl = '', port = 4173 } = {}) {
  const configured = String(appOrigin || '').trim().replace(/\/+$/, '');
  const render = String(renderExternalUrl || '').trim().replace(/\/+$/, '');
  if (configured && !isLoopbackOrigin(configured)) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.origin;
    } catch {}
  }
  if (render) {
    try {
      const parsed = new URL(render);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.origin;
    } catch {}
  }
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.origin;
    } catch {}
  }
  return `http://localhost:${Number(port) || 4173}`;
}

module.exports = { resolveAppOrigin, isLoopbackOrigin };
