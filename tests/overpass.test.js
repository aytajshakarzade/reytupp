'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildOverpassQuery, createOverpassClient, DEFAULT_ENDPOINTS } = require('../overpass');

function jsonResponse(elements, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    async json() { return { elements }; }
  };
}

test('Overpass query is category-aware, bounded and has a server budget below client timeout', () => {
  const query = buildOverpassQuery(40.4093, 49.8671, 'cafe', 1200);
  assert.match(query, /\[out:json\]\[timeout:12\]/);
  assert.match(query, /\[amenity=cafe\]/);
  assert.match(query, /\[highway=bus_stop\]/);
  assert.match(query, /\[amenity=school\]/);
  assert.match(query, /\[office\]/);
  assert.match(query, /\[building=apartments\]/);
  assert.match(query, /\[highway=footway\]/);
  assert.match(query, /out center tags/);
  assert.throws(() => buildOverpassQuery(100, 49.8, 'cafe'), /koordinatları düzgün deyil/);
  assert.throws(() => buildOverpassQuery(0, 0, 'cafe'), /koordinatları düzgün deyil/);
});

test('Overpass client sends identifiable app headers and parses returned elements', async () => {
  let captured;
  const client = createOverpassClient({
    endpoints: ['https://example.test/interpreter'],
    userAgent: 'ReytUp/4.2 (test app)',
    referer: 'https://reytup.example/',
    minIntervalMs: 0,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return jsonResponse([{ type: 'node', id: 1, lat: 40.4, lon: 49.8, tags: { amenity: 'cafe' } }]);
    }
  });
  const query = buildOverpassQuery(40.4, 49.8, 'cafe');
  const result = await client.fetch(query);
  assert.equal(result.length, 1);
  assert.equal(captured.options.headers['user-agent'], 'ReytUp/4.2 (test app)');
  assert.equal(captured.options.headers.referer, 'https://reytup.example/');
  assert.equal(captured.options.method, 'POST');
  assert.match(captured.options.body, /^data=/);
});

test('Overpass 403/406 access rejection fails over to another public instance', async () => {
  const calls = [];
  const client = createOverpassClient({
    endpoints: ['https://blocked.example/interpreter', 'https://second.example/interpreter'],
    minIntervalMs: 0,
    fetchImpl: async url => { calls.push(url); return calls.length === 1 ? jsonResponse([], 406) : jsonResponse([{ type: 'node', id: 8 }]); }
  });
  const result = await client.fetch('[out:json];out;');
  assert.deepEqual(calls, ['https://blocked.example/interpreter', 'https://second.example/interpreter']);
  assert.equal(result[0].id, 8);
});

test('Overpass transient gateway errors fail over sequentially to the documented secondary server', async () => {
  const calls = [];
  const client = createOverpassClient({
    endpoints: ['https://primary.example/interpreter', 'https://secondary.example/interpreter'],
    minIntervalMs: 0,
    fetchImpl: async url => {
      calls.push(url);
      return calls.length === 1 ? jsonResponse([], 504) : jsonResponse([{ type: 'node', id: 7 }]);
    }
  });
  const result = await client.fetch('[out:json];out;');
  assert.deepEqual(calls, ['https://primary.example/interpreter', 'https://secondary.example/interpreter']);
  assert.equal(result[0].id, 7);
});

test('default Overpass endpoints avoid the overloaded endpoint that returned 406 for this setup', () => {
  assert.deepEqual(DEFAULT_ENDPOINTS, [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ]);
});
