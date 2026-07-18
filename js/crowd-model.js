/**
 * @fileoverview Crowd management calculation engine
 * @description Pure functions estimating crowd density, gate congestion,
 *              wait times and safe evacuation windows for stadium operations.
 *              Formulas are grounded in published crowd-safety standards so
 *              operators can trust the numbers behind every recommendation.
 *
 * Primary sources:
 *   - UK Home Office "Guide to Safety at Sports Grounds" (Green Guide, 6th ed.)
 *     density and flow-rate benchmarks for spectator areas and gangways.
 *     https://www.gov.uk/government/publications/6th-edition-of-the-green-guide
 *   - Fruin, J.J. "Pedestrian Planning and Design" — Level of Service (LOS)
 *     density bands (A–F) used industry-wide for crowd flow assessment.
 *   - NFPA 101 Life Safety Code — egress capacity factors for assembly
 *     occupancies (persons per minute per unit exit width).
 *
 * @module crowd-model
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Fruin pedestrian Level-of-Service density thresholds, in persons per m².
 * LOS A is free-flow; LOS F is at capacity with risk of crowd crush.
 * @type {ReadonlyArray<{max: number, label: string, risk: string}>}
 */
export const LOS_BANDS = Object.freeze([
  { max: 0.31, label: 'A', risk: 'free-flow' },
  { max: 0.43, label: 'B', risk: 'comfortable' },
  { max: 0.72, label: 'C', risk: 'restricted' },
  { max: 1.08, label: 'D', risk: 'congested' },
  { max: 2.17, label: 'E', risk: 'high-density' },
  { max: Infinity, label: 'F', risk: 'critical' },
]);

/** Green Guide recommended maximum flow rate through a 1m gangway/turnstile (persons/minute) */
const MAX_FLOW_RATE_PER_METRE_PER_MIN = 82;

/** NFPA 101 egress capacity factor — persons per minute per unit (0.56m) of exit width for assembly occupancies */
const NFPA_EGRESS_PERSONS_PER_UNIT_PER_MIN = 60;

/** Standard NFPA egress unit width in metres (22 inches) */
const NFPA_EGRESS_UNIT_WIDTH_M = 0.559;

/** Safety margin applied to raw evacuation time estimates (accounts for panic, mixed mobility, signage lag) */
const EVACUATION_SAFETY_MARGIN = 1.35;

/** Minutes considered the upper bound for a fully safe full-stadium evacuation per Green Guide guidance */
export const RECOMMENDED_MAX_EVACUATION_MIN = 8;

// ─── Density & Level of Service ──────────────────────────────────────────────

/**
 * Calculates crowd density in persons per square metre.
 * @param {number} occupants - Number of people in the area
 * @param {number} areaM2    - Area in square metres
 * @returns {number} Density (persons/m²), or 0 for non-positive area
 */
export function calcDensity(occupants, areaM2) {
  if (areaM2 <= 0) return 0;
  return Math.max(0, occupants) / areaM2;
}

/**
 * Maps a density value to its Fruin Level-of-Service band.
 * @param {number} density - Persons per square metre
 * @returns {{label:string, risk:string}} LOS classification
 */
export function getLOS(density) {
  const band = LOS_BANDS.find((b) => density <= b.max);
  return { label: band.label, risk: band.risk };
}

// ─── Gate / turnstile congestion ─────────────────────────────────────────────

/**
 * Estimates the wait time at a gate or turnstile bank given an arrival rate.
 *
 * @param {number} arrivalsPerMin - Fans arriving per minute at this gate
 * @param {number} gateWidthM     - Total effective gate width in metres
 * @param {number} queueLength    - Current number of people already queued
 * @returns {number} Estimated additional wait time in minutes for a fan joining now
 */
export function estimateGateWaitMinutes(arrivalsPerMin, gateWidthM, queueLength) {
  const throughputPerMin = Math.max(gateWidthM, 0.1) * MAX_FLOW_RATE_PER_METRE_PER_MIN;
  if (throughputPerMin <= 0) return Infinity;

  // Net drain rate: how fast the existing queue shrinks once throughput
  // absorbs ongoing arrivals. When arrivals exceed throughput, the queue
  // never clears at the gate alone — model as a large multiplier of base wait.
  const netDrainRate = throughputPerMin - arrivalsPerMin;
  const baseWait = netDrainRate > 0
    ? queueLength / netDrainRate
    : (queueLength / throughputPerMin) + (arrivalsPerMin / throughputPerMin) * 5;

  return Math.round(baseWait * 10) / 10;
}

/**
 * Determines whether a gate is at risk of dangerous congestion, based on
 * whether sustained arrivals exceed safe throughput capacity.
 *
 * @param {number} arrivalsPerMin - Fans arriving per minute
 * @param {number} gateWidthM     - Total effective gate width in metres
 * @returns {boolean} True if arrivals exceed 90% of maximum safe throughput
 */
export function isGateOverCapacity(arrivalsPerMin, gateWidthM) {
  const safeThroughput = Math.max(gateWidthM, 0.1) * MAX_FLOW_RATE_PER_METRE_PER_MIN;
  return arrivalsPerMin > safeThroughput * 0.9;
}

// ─── Evacuation time modelling ────────────────────────────────────────────────

/**
 * Estimates total safe evacuation time for a stand or the full stadium,
 * per NFPA 101 assembly-occupancy egress capacity guidance.
 *
 * @param {number} occupants     - Total people to be evacuated
 * @param {number} exitWidthM    - Total combined width of available exits, in metres
 * @returns {number} Estimated evacuation time in minutes, including safety margin
 */
export function estimateEvacuationMinutes(occupants, exitWidthM) {
  if (occupants <= 0) return 0;
  if (exitWidthM <= 0) return Infinity;

  const exitUnits         = exitWidthM / NFPA_EGRESS_UNIT_WIDTH_M;
  const throughputPerMin  = exitUnits * NFPA_EGRESS_PERSONS_PER_UNIT_PER_MIN;
  const rawMinutes        = occupants / throughputPerMin;

  return Math.round(rawMinutes * EVACUATION_SAFETY_MARGIN * 10) / 10;
}

/**
 * Flags whether an evacuation plan meets the recommended safety window.
 * @param {number} evacuationMinutes - Estimated evacuation time
 * @returns {boolean} True if within the recommended maximum
 */
export function isEvacuationSafe(evacuationMinutes) {
  return evacuationMinutes <= RECOMMENDED_MAX_EVACUATION_MIN;
}

// ─── Zone risk scoring ────────────────────────────────────────────────────────

/**
 * Computes a composite 0–100 risk score for a stadium zone, combining
 * density, gate congestion and evacuation adequacy into a single operator-
 * facing metric. Higher scores indicate more urgent attention required.
 *
 * @param {Object} zone
 * @param {number} zone.occupants     - Current occupants in the zone
 * @param {number} zone.areaM2        - Zone floor area in m²
 * @param {number} zone.arrivalsPerMin- Current arrival rate into the zone
 * @param {number} zone.gateWidthM    - Effective gate width serving the zone
 * @param {number} zone.exitWidthM    - Effective exit width for evacuation
 * @returns {{score:number, los:{label:string,risk:string}, evacuationMin:number, overCapacity:boolean}}
 */
export function computeZoneRisk(zone) {
  const density        = calcDensity(zone.occupants, zone.areaM2);
  const los            = getLOS(density);
  const evacuationMin  = estimateEvacuationMinutes(zone.occupants, zone.exitWidthM);
  const overCapacity   = isGateOverCapacity(zone.arrivalsPerMin, zone.gateWidthM);

  const densityScore     = Math.min((density / 2.17) * 60, 60);
  const evacuationScore  = Math.min((evacuationMin / RECOMMENDED_MAX_EVACUATION_MIN) * 30, 30);
  const congestionScore  = overCapacity ? 10 : 0;

  const score = Math.round(densityScore + evacuationScore + congestionScore);

  return { score: Math.min(score, 100), los, evacuationMin, overCapacity };
}

/**
 * Classifies a composite risk score into an operator-facing alert level.
 * @param {number} score - Risk score from computeZoneRisk (0–100)
 * @returns {'normal'|'watch'|'alert'|'critical'}
 */
export function classifyRiskLevel(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'alert';
  if (score >= 35) return 'watch';
  return 'normal';
}