'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCompetitionMetric, competitionScoreFromCount, physicalFitScore, extractDemandSignals, marketDemandScore } = require('../analysis-metrics');

test('competition metric prefers complete OSM data when available', () => {
  assert.deepEqual(resolveCompetitionMetric({
    overpassWorked: true, osmCount: 8, googlePlacesWorked: true, googleCount: 20
  }), {
    count: 8, source: 'OpenStreetMap / Overpass', isSample: false, confidence: 'MEDIUM'
  });
});

test('competition metric falls back to Google sample with low confidence', () => {
  assert.deepEqual(resolveCompetitionMetric({
    overpassWorked: false, osmCount: null, googlePlacesWorked: true, googleCount: 17
  }), {
    count: 17, source: 'Google Places sample', isSample: true, confidence: 'LOW'
  });
});

test('competition metric remains unavailable only when both sources fail', () => {
  assert.equal(resolveCompetitionMetric({
    overpassWorked: false, osmCount: null, googlePlacesWorked: false, googleCount: null
  }).count, null);
});

test('sample competition score follows the published formula and clamps the count at 20', () => {
  assert.equal(competitionScoreFromCount(20, 3), 6);
  assert.equal(competitionScoreFromCount(25, 3), 6);
  assert.equal(competitionScoreFromCount(null, 3), null);
  assert.equal(competitionScoreFromCount(2, 5), 20);
});


test('physical fit stays unavailable until at least three property facts are provided', () => {
  assert.equal(physicalFitScore({ areaSqm: 40, floorLevel: 0 }, 'cafe').score, null);
  const result = physicalFitScore({ areaSqm: 40, floorLevel: 0, displayWindow: 'large', entranceType: 'street', ventilation: 'good' }, 'cafe');
  assert.equal(result.score, 20);
  assert.equal(result.providedCount, 5);
  assert.equal(physicalFitScore({ areaSqm: 40, floorLevel: 0, displayWindow: 'large' }, 'cafe').score, 20);
});

test('market demand uses separate OSM context proxies and never treats pedestrian infrastructure as measured footfall', () => {
  const context = extractDemandSignals([
    { type:'node', id:1, tags:{amenity:'school'} },
    { type:'node', id:2, tags:{office:'company'} },
    { type:'way', id:3, tags:{building:'apartments'} },
    { type:'way', id:4, tags:{highway:'footway'} }
  ]);
  assert.deepEqual(context, { educationCount:1, officeCount:1, residentialCount:1, pedestrianInfrastructureCount:1, footTrafficMeasured:false });
  assert.equal(marketDemandScore(context, true), 2);
  assert.equal(marketDemandScore(context, false), null);
});
