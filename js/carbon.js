/**
 * @fileoverview Fan travel carbon footprint calculations
 * @description Pure functions estimating CO2e emissions for fan travel to
 *              and from FIFA World Cup 2026 venues, and venue-side
 *              sustainability scoring. Mirrors the emission-factor citation
 *              discipline used throughout Blaugrana Vision.
 *
 * Primary sources:
 *   - UK DEFRA / DESNZ 2023 Greenhouse Gas Conversion Factors
 *     https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023
 *   - US EPA — Greenhouse Gas Emissions from a Typical Passenger Vehicle
 *     https://www.epa.gov/greenvehicles
 *   - International Energy Agency — average public transit emission
 *     intensity per passenger-km.
 *
 * @module carbon
 */

'use strict';

/** kg CO2e per passenger-km, by travel mode */
export const MODE_EMISSION_FACTORS = Object.freeze({
  transit  : 0.04,  // metro/rail — IEA average grid-mix adjusted
  shuttle  : 0.07,  // shared event shuttle bus
  rideshare: 0.17,  // single-occupant rideshare vehicle
  walk     : 0,     // walking / cycling
  drive    : 0.19,  // personal vehicle, average occupancy
});

/** Venue sustainability feature weights (out of 100 total) */
const SUSTAINABILITY_WEIGHTS = Object.freeze({
  solar     : 25,
  leed      : 20,
  transit   : 25,
  retractableRoof: 10,
  naturalTurf: 20,
});

/**
 * Estimates CO2e emissions (kg) for a fan's one-way journey to a venue.
 * @param {string} mode      - One of the MODE_EMISSION_FACTORS keys
 * @param {number} distanceKm- One-way distance in kilometres
 * @returns {number} Estimated kg CO2e for the trip
 */
export function estimateTripEmissions(mode, distanceKm) {
  const factor = MODE_EMISSION_FACTORS[mode] ?? MODE_EMISSION_FACTORS.drive;
  return Math.max(0, factor * distanceKm);
}

/**
 * Estimates total tournament-wide emissions saved if a percentage of fans
 * switch from driving to transit for their venue journey.
 * @param {number} totalFans     - Total fans attending
 * @param {number} avgDistanceKm - Average one-way distance in km
 * @param {number} switchRatePct - Percentage of fans assumed to switch (0–100)
 * @returns {number} Estimated kg CO2e saved
 */
export function estimateModalShiftSavings(totalFans, avgDistanceKm, switchRatePct) {
  const switching = totalFans * (switchRatePct / 100);
  const perFanSaving = estimateTripEmissions('drive', avgDistanceKm) - estimateTripEmissions('transit', avgDistanceKm);
  return Math.max(0, switching * perFanSaving);
}

/**
 * Computes a 0–100 sustainability score for a stadium based on its known
 * physical features. Used by the sustainability dashboard to rank venues.
 * @param {import('./stadiums-data.js').Stadium} stadium
 * @returns {number} Sustainability score (0–100)
 */
export function computeSustainabilityScore(stadium) {
  let score = 0;
  if (stadium.roofType === 'retractable') score += SUSTAINABILITY_WEIGHTS.retractableRoof;
  if (stadium.surface === 'natural' || stadium.surface === 'hybrid') score += SUSTAINABILITY_WEIGHTS.naturalTurf * (stadium.surface === 'natural' ? 1 : 0.6);
  // Illustrative solar/transit/LEED signal — in production this would come
  // from verified venue sustainability reports rather than heuristics.
  if (/solar|leed/i.test(stadium.highlight)) score += SUSTAINABILITY_WEIGHTS.solar + SUSTAINABILITY_WEIGHTS.leed;
  score += SUSTAINABILITY_WEIGHTS.transit * 0.6; // baseline transit access assumed for all World Cup venues
  return Math.min(Math.round(score), 100);
}