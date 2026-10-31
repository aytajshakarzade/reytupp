'use strict';

/** Select a competition input without pretending a capped Google sample is complete. */
function resolveCompetitionMetric({ overpassWorked, osmCount, googlePlacesWorked, googleCount }) {
  const hasCount = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  if (overpassWorked && hasCount(osmCount)) {
    return { count: Number(osmCount), source: 'OpenStreetMap / Overpass', isSample: false, confidence: 'MEDIUM' };
  }
  if (googlePlacesWorked && hasCount(googleCount)) {
    return { count: Number(googleCount), source: 'Google Places sample', isSample: true, confidence: 'LOW' };
  }
  return { count: null, source: null, isSample: false, confidence: 'UNAVAILABLE' };
}

/** Max 20. Optional, user-supplied property facts only; null means insufficient inputs. */
function physicalFitScore(physical = {}, businessType = 'other') {
  const area = Number(physical.areaSqm);
  const floor = Number(physical.floorLevel);
  const weights = { area: 6, floor: 4, displayWindow: 4, entranceType: 4, ventilation: 2 };
  const values = {};
  if (Number.isFinite(area) && area > 0 && area <= 100000) {
    const recommended = ({ cafe:40, restaurant:70, fast_food:25, retail:25, beauty:35, medical:50, clothing:35, pharmacy:30, supermarket:120, bakery:25, electronics:35, fitness:150, other:40 })[businessType] || 40;
    values.area = Math.max(0, Math.min(1, 1 - Math.abs(Math.log(area / recommended)) / 2.2)) * weights.area;
  }
  if (Number.isInteger(floor) && floor >= -5 && floor <= 100) {
    values.floor = (floor === 0 ? 1 : floor === 1 ? 0.7 : floor > 1 ? 0.35 : 0.15) * weights.floor;
  }
  const windowMap = { large:1, standard:0.75, limited:0.35, none:0 };
  if (Object.hasOwn(windowMap, physical.displayWindow)) values.displayWindow = windowMap[physical.displayWindow] * weights.displayWindow;
  const entranceMap = { street:1, mall:0.85, shared:0.55, upper:0.3, basement:0.15 };
  if (Object.hasOwn(entranceMap, physical.entranceType)) values.entranceType = entranceMap[physical.entranceType] * weights.entranceType;
  const ventilationMap = { good:1, limited:0.5, none:0 };
  if (Object.hasOwn(ventilationMap, physical.ventilation)) values.ventilation = ventilationMap[physical.ventilation] * weights.ventilation;
  const keys = Object.keys(values);
  const availableWeight = keys.reduce((sum, key) => sum + weights[key], 0);
  const providedCount = keys.length;
  if (providedCount < 3 || availableWeight === 0) return { score:null, providedCount, availableWeight, max:20, details:values };
  const earned = keys.reduce((sum,key) => sum + values[key],0);
  return { score:Math.round((earned / availableWeight) * 20), providedCount, availableWeight, max:20, details:values };
}

/** OSM proxy counts. Pedestrian infrastructure is not measured footfall. */
function extractDemandSignals(elements = []) {
  const sets = { education:new Set(), offices:new Set(), residential:new Set(), pedestrianInfrastructure:new Set() };
  for (const element of elements) {
    const tags = element?.tags || {};
    const id = `${element?.type || 'n'}:${element?.id ?? JSON.stringify(tags)}`;
    if (['school','university','college','kindergarten'].includes(tags.amenity) || tags.education) sets.education.add(id);
    if (tags.office && !['no','none'].includes(tags.office)) sets.offices.add(id);
    if (['apartments','residential','dormitory'].includes(tags.building) || tags.landuse === 'residential') sets.residential.add(id);
    if (['pedestrian','footway','living_street'].includes(tags.highway)) sets.pedestrianInfrastructure.add(id);
  }
  return {
    educationCount:sets.education.size,
    officeCount:sets.offices.size,
    residentialCount:sets.residential.size,
    pedestrianInfrastructureCount:sets.pedestrianInfrastructure.size,
    footTrafficMeasured:false
  };
}

/** Transparent context score (max 25); calculated only from a successful OSM read. */
function marketDemandScore(context, sourceAvailable) {
  if (!sourceAvailable || !context) return null;
  const rules = [
    ['educationCount',5,5],
    ['officeCount',5,10],
    ['residentialCount',8,80],
    ['pedestrianInfrastructureCount',7,20]
  ];
  let availableWeight = 0;
  let earned = 0;
  for (const [key, weight, saturation] of rules) {
    const value = context[key];
    if (value === null || value === undefined || !Number.isFinite(Number(value))) continue;
    availableWeight += weight;
    earned += Math.min(1, Math.max(0, Number(value) / saturation)) * weight;
  }
  return availableWeight >= 10 ? Math.round((earned / availableWeight) * 25) : null;
}

/** Same transparent scoring rule used by the analysis breakdown. */
function competitionScoreFromCount(count, tolerance = 3) {
  if (count === null || count === undefined || !Number.isFinite(Number(count))) return null;
  const safeTolerance = Math.max(1, Math.min(5, Number(tolerance) || 3));
  return Math.round(Math.max(0, 20 - Math.min(20, Number(count)) * (1.2 * (6 - safeTolerance) / 5)));
}

module.exports = { resolveCompetitionMetric, competitionScoreFromCount, physicalFitScore, extractDemandSignals, marketDemandScore };
