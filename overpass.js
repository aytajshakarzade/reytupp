'use strict';

const DEFAULT_ENDPOINTS = Object.freeze([
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]);

const BUSINESS_FILTERS = Object.freeze({
  cafe: [['amenity', 'cafe'], ['shop', 'coffee']],
  restaurant: [['amenity', 'restaurant']],
  fast_food: [['amenity', 'fast_food']],
  retail: [['shop', null]],
  beauty: [['shop', 'beauty'], ['shop', 'hairdresser'], ['shop', 'beauty_salon'], ['amenity', 'beauty_salon']],
  medical: [['amenity', 'doctors'], ['amenity', 'clinic'], ['amenity', 'hospital'], ['amenity', 'dentist'], ['healthcare', null]],
  clothing: [['shop', 'clothes'], ['shop', 'shoes']],
  pharmacy: [['amenity', 'pharmacy'], ['shop', 'chemist']],
  supermarket: [['shop', 'supermarket']],
  fitness: [['leisure', 'fitness_centre'], ['leisure', 'sports_centre']],
  electronics: [['shop', 'electronics']],
  bakery: [['shop', 'bakery']],
  other: [['amenity', 'restaurant'], ['amenity', 'cafe'], ['amenity', 'fast_food'], ['shop', null]]
});

function validateCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      (latitude === 0 && longitude === 0)) {
    throw new TypeError('Overpass koordinatları düzgün deyil.');
  }
  return { latitude, longitude };
}

function buildOverpassQuery(lat, lng, type, radiusMeters = 1200) {
  const point = validateCoordinates(lat, lng);
  const radius = Math.max(300, Math.min(5000, Math.round(Number(radiusMeters) || 1200)));
  const filters = BUSINESS_FILTERS[type] || BUSINESS_FILTERS.other;
  const around = (key, value) => `nwr(around:${radius},${point.latitude},${point.longitude})[${key}${value === null ? '' : `=${value}`}];`;
  const businessSelectors = filters.map(([key, value]) => around(key, value)).join('');
  const transportSelectors = [
    around('public_transport', 'platform'),
    around('highway', 'bus_stop'),
    around('railway', 'station')
  ].join('');
  // These are contextual proxies (not measured population, demand or pedestrian counts).
  const demandSelectors = [
    ...['school','university','college','kindergarten'].map(value => around('amenity', value)),
    around('office', null),
    ...['apartments','residential','dormitory'].map(value => around('building', value)),
    around('landuse', 'residential'),
    ...['pedestrian','footway','living_street'].map(value => around('highway', value))
  ].join('');

  // Keep server execution budget below the HTTP timeout so the client does not abort a valid query early.
  return `[out:json][timeout:12];(${businessSelectors}${transportSelectors}${demandSelectors});out center tags;`;
}

function makeError(message, code, status = null) {
  const error = new Error(message);
  error.code = code;
  if (status !== null) error.status = status;
  return error;
}

function createOverpassClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');

  const endpoints = Array.isArray(options.endpoints) && options.endpoints.length
    ? options.endpoints.slice()
    : DEFAULT_ENDPOINTS.slice();
  const userAgent = String(options.userAgent || 'ReytUp/4.2 (location intelligence)').replace(/[\r\n]/g, ' ').trim();
  const referer = String(options.referer || 'http://localhost:4173/').replace(/[\r\n]/g, '').trim();
  const timeoutMs = Math.max(5_000, Math.min(30_000, Number(options.timeoutMs) || 16_000));
  const minIntervalMs = Math.max(0, Math.min(30_000, Number(options.minIntervalMs) || 0));
  const cacheTtlMs = Math.max(0, Math.min(60 * 60 * 1000, Number(options.cacheTtlMs) || 0));
  const cache = new Map();
  const inFlight = new Map();
  let requestQueue = Promise.resolve();
  let lastRequestAt = 0;

  async function waitForRequestSlot() {
    if (!minIntervalMs) return;
    const slot = requestQueue.then(async () => {
      const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
    });
    requestQueue = slot.catch(() => {});
    await slot;
  }

  async function request(query) {
    let lastError = null;
    for (let index = 0; index < endpoints.length; index += 1) {
      const endpoint = endpoints[index];
      await waitForRequestSlot();
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            accept: 'application/json',
            'user-agent': userAgent,
            referer
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(timeoutMs)
        });

        if (response.status === 406 || response.status === 403) {
          // Access rules differ between public instances and hosting networks.
          // A rejection from one provider must not prevent trying the next one.
          lastError = makeError(`Overpass instansı HTTP ${response.status} ilə sorğunu rədd etdi. Növbəti instans yoxlanılır.`, 'OVERPASS_ACCESS_REJECTED', response.status);
          continue;
        }
        if (response.status === 429) {
          const retryAfter = response.headers?.get?.('retry-after');
          const waitText = retryAfter ? ` Retry-After: ${retryAfter}.` : '';
          lastError = makeError(`Overpass instansında sorğu limiti dolub.${waitText} Növbəti instans yoxlanılır.`, 'OVERPASS_RATE_LIMITED', 429);
          continue;
        }
        if (!response.ok) {
          const status = response.status;
          const retryable = [408, 500, 502, 503, 504].includes(status);
          lastError = makeError(`Overpass HTTP ${status} cavabı qaytardı.`, `OVERPASS_HTTP_${status}`, status);
          if (!retryable) throw lastError;
          continue;
        }

        let payload;
        try { payload = await response.json(); }
        catch { throw makeError('Overpass JSON formatında cavab qaytarmadı.', 'OVERPASS_INVALID_JSON'); }
        if (!payload || !Array.isArray(payload.elements)) {
          throw makeError('Overpass cavabında elements siyahısı yoxdur.', 'OVERPASS_INVALID_RESPONSE');
        }
        return payload.elements;
      } catch (error) {
        lastError = error;
        if (error.code === 'OVERPASS_INVALID_JSON' || error.code === 'OVERPASS_INVALID_RESPONSE' ||
            (error.status && ![408, 403, 406, 429, 500, 502, 503, 504].includes(error.status))) {
          throw error;
        }
        // A transient server/network failure may use the next documented global instance.
        // Requests are sequential and never duplicated in parallel.
      }
    }
    throw lastError || makeError('Overpass xəritə xidməti hazırda əlçatan deyil.', 'OVERPASS_UNAVAILABLE');
  }

  function cacheKey(meta) {
    if (!meta || !Number.isFinite(Number(meta.lat)) || !Number.isFinite(Number(meta.lng))) return null;
    return `${Number(meta.lat).toFixed(4)}:${Number(meta.lng).toFixed(4)}:${meta.type || 'other'}:${Number(meta.radiusMeters) || 1200}`;
  }

  return {
    async fetch(query, meta = null) {
      const key = cacheKey(meta);
      if (key && cacheTtlMs) {
        const cached = cache.get(key);
        if (cached && cached.expiresAt > Date.now()) return cached.elements;
        const pending = inFlight.get(key);
        if (pending) return pending;
      }
      const operation = request(query).then(elements => {
        if (key && cacheTtlMs) {
          cache.set(key, { elements, expiresAt: Date.now() + cacheTtlMs });
          if (cache.size > 500) cache.delete(cache.keys().next().value);
        }
        return elements;
      }).finally(() => { if (key) inFlight.delete(key); });
      if (key && cacheTtlMs) inFlight.set(key, operation);
      return operation;
    },
    clearCache() { cache.clear(); },
    endpoints: endpoints.slice()
  };
}

module.exports = { DEFAULT_ENDPOINTS, buildOverpassQuery, createOverpassClient };
