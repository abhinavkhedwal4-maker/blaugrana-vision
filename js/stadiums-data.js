/**
 * @fileoverview FIFA World Cup 2026 host stadium reference data
 * @description Verified venue data for all 16 stadiums hosting the FIFA
 *              World Cup 2026 across the United States, Mexico and Canada.
 *              Capacities reflect FIFA's official tournament-configuration
 *              figures. Coordinates are approximate stadium locations used
 *              for map and 3D-scene positioning only — not for navigation.
 *
 * Primary source: FIFA official stadium capacity confirmation
 *   https://inside.fifa.com/news/fifa-world-cup-stadium-capacities-confirmed
 * Secondary source: FIFA official stadium address/capacity listing
 *   https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/stadium-information-details
 *
 * @module stadiums-data
 */

'use strict';

/**
 * All 16 FIFA World Cup 2026 host stadiums.
 * `id` is a URL-safe slug used across pages (3D viewer, navigator, crowd ops).
 * `shape` drives the procedural 3D geometry in stadium-3d.js.
 *
 * @typedef {Object} Stadium
 * @property {string} id            - URL-safe slug
 * @property {string} fifaName      - Official FIFA tournament name (neutral)
 * @property {string} commonName    - Locally known stadium name
 * @property {string} city          - Host city
 * @property {string} country       - Host country
 * @property {number} capacity      - FIFA-confirmed tournament capacity
 * @property {number} lat           - Approximate latitude
 * @property {number} lng           - Approximate longitude
 * @property {string} tier          - 'final' | 'semifinal' | 'group' — tournament role
 * @property {string} shape         - 'bowl' | 'dome' | 'horseshoe' — 3D model archetype
 * @property {string} roofType      - 'open' | 'retractable' | 'fixed'
 * @property {string} surface       - 'natural' | 'hybrid'
 * @property {string} highlight     - One-line notable fact
 * @property {number} elevationM    - Elevation above sea level in metres (affects match conditions)
 *
 * @type {ReadonlyArray<Stadium>}
 */
export const STADIUMS = Object.freeze([
  {
    id: 'mexico-city', fifaName: 'Mexico City Stadium', commonName: 'Estadio Azteca',
    city: 'Mexico City', country: 'Mexico', capacity: 80824,
    lat: 19.3029, lng: -99.1505, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'hybrid',
    highlight: 'First stadium in history to host matches at three separate World Cups (1970, 1986, 2026). Hosts the tournament opener.',
    elevationM: 2200,
  },
  {
    id: 'new-york-new-jersey', fifaName: 'New York New Jersey Stadium', commonName: 'MetLife Stadium',
    city: 'East Rutherford, NJ', country: 'United States', capacity: 80663,
    lat: 40.8135, lng: -74.0745, tier: 'final', shape: 'bowl',
    roofType: 'open', surface: 'hybrid',
    highlight: "Hosts the FIFA World Cup 2026 Final on July 19 — the tournament's showpiece match.",
    elevationM: 4,
  },
  {
    id: 'dallas', fifaName: 'Dallas Stadium', commonName: 'AT&T Stadium',
    city: 'Arlington, TX', country: 'United States', capacity: 70649,
    lat: 32.7473, lng: -97.0945, tier: 'semifinal', shape: 'dome',
    roofType: 'retractable', surface: 'hybrid',
    highlight: 'Known as "Jerry World" — one of the most technologically advanced stadiums in the world, hosts a Semifinal.',
    elevationM: 168,
  },
  {
    id: 'atlanta', fifaName: 'Atlanta Stadium', commonName: 'Mercedes-Benz Stadium',
    city: 'Atlanta, GA', country: 'United States', capacity: 68239,
    lat: 33.7554, lng: -84.4008, tier: 'semifinal', shape: 'dome',
    roofType: 'retractable', surface: 'hybrid',
    highlight: 'Distinctive pinwheel retractable roof; hosted Super Bowl LIII. Stages the second Semifinal.',
    elevationM: 320,
  },
  {
    id: 'miami', fifaName: 'Miami Stadium', commonName: 'Hard Rock Stadium',
    city: 'Miami Gardens, FL', country: 'United States', capacity: 64478,
    lat: 25.9580, lng: -80.2389, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'natural',
    highlight: 'Natural Bermuda grass throughout — no turf swap required. Hosts the third-place playoff.',
    elevationM: 3,
  },
  {
    id: 'los-angeles', fifaName: 'Los Angeles Stadium', commonName: 'SoFi Stadium',
    city: 'Inglewood, CA', country: 'United States', capacity: 70492,
    lat: 33.9535, lng: -118.3392, tier: 'group', shape: 'dome',
    roofType: 'fixed', surface: 'hybrid',
    highlight: 'Translucent ETFE canopy roof and one of the largest 4K video boards of any stadium in the world.',
    elevationM: 29,
  },
  {
    id: 'san-francisco-bay-area', fifaName: 'San Francisco Bay Area Stadium', commonName: "Levi's Stadium",
    city: 'Santa Clara, CA', country: 'United States', capacity: 68827,
    lat: 37.4030, lng: -121.9700, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'hybrid',
    highlight: 'Solar-powered venue with LEED Gold certification, reflecting a strong sustainability profile.',
    elevationM: 12,
  },
  {
    id: 'seattle', fifaName: 'Seattle Stadium', commonName: 'Lumen Field',
    city: 'Seattle, WA', country: 'United States', capacity: 66925,
    lat: 47.5952, lng: -122.3316, tier: 'group', shape: 'horseshoe',
    roofType: 'fixed', surface: 'natural',
    highlight: 'Partial roof creates one of the loudest atmospheres in world sport via acoustic sound-trapping design.',
    elevationM: 5,
  },
  {
    id: 'kansas-city', fifaName: 'Kansas City Stadium', commonName: 'Arrowhead Stadium',
    city: 'Kansas City, MO', country: 'United States', capacity: 69045,
    lat: 39.0489, lng: -94.4839, tier: 'group', shape: 'horseshoe',
    roofType: 'open', surface: 'hybrid',
    highlight: 'Guinness World Record holder for loudest outdoor stadium crowd roar.',
    elevationM: 268,
  },
  {
    id: 'houston', fifaName: 'Houston Stadium', commonName: 'NRG Stadium',
    city: 'Houston, TX', country: 'United States', capacity: 68777,
    lat: 29.6847, lng: -95.4107, tier: 'group', shape: 'dome',
    roofType: 'retractable', surface: 'hybrid',
    highlight: 'First NFL stadium built with a retractable roof; hosted the Copa América Centenario in 2016.',
    elevationM: 13,
  },
  {
    id: 'philadelphia', fifaName: 'Philadelphia Stadium', commonName: 'Lincoln Financial Field',
    city: 'Philadelphia, PA', country: 'United States', capacity: 68324,
    lat: 39.9008, lng: -75.1675, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'hybrid',
    highlight: 'One of the most sustainable stadiums in US sport — on-site solar and wind generation.',
    elevationM: 12,
  },
  {
    id: 'boston', fifaName: 'Boston Stadium', commonName: 'Gillette Stadium',
    city: 'Foxborough, MA', country: 'United States', capacity: 64146,
    lat: 42.0909, lng: -71.2643, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'hybrid',
    highlight: "Also hosted 1994 World Cup matches at the site's previous stadium — football returns to Foxboro after 32 years.",
    elevationM: 46,
  },
  {
    id: 'toronto', fifaName: 'Toronto Stadium', commonName: 'BMO Field',
    city: 'Toronto', country: 'Canada', capacity: 43036,
    lat: 43.6332, lng: -79.4185, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'natural',
    highlight: "Smallest venue of the tournament and Toronto's first-ever World Cup hosting duty.",
    elevationM: 76,
  },
  {
    id: 'vancouver', fifaName: 'Vancouver Stadium', commonName: 'BC Place',
    city: 'Vancouver', country: 'Canada', capacity: 52497,
    lat: 49.2768, lng: -123.1119, tier: 'group', shape: 'dome',
    roofType: 'fixed', surface: 'hybrid',
    highlight: "Retractable-cable roof structure; Vancouver's first FIFA World Cup fixtures.",
    elevationM: 1,
  },
  {
    id: 'guadalajara', fifaName: 'Guadalajara Stadium', commonName: 'Estadio Akron',
    city: 'Zapopan, Jalisco', country: 'Mexico', capacity: 45664,
    lat: 20.6820, lng: -103.4620, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'natural',
    highlight: 'Spherical, coliseum-like architecture — one of the most visually distinctive venues in the tournament.',
    elevationM: 1566,
  },
  {
    id: 'monterrey', fifaName: 'Monterrey Stadium', commonName: 'Estadio BBVA',
    city: 'Guadalupe, Nuevo León', country: 'Mexico', capacity: 51243,
    lat: 25.6694, lng: -100.2436, tier: 'group', shape: 'bowl',
    roofType: 'open', surface: 'natural',
    highlight: 'Set against the dramatic backdrop of the Sierra Madre mountains.',
    elevationM: 538,
  },
]);

/**
 * Looks up a stadium by its URL-safe id.
 * @param {string} id - Stadium slug (e.g. 'mexico-city')
 * @returns {Stadium|undefined}
 */
export function getStadiumById(id) {
  return STADIUMS.find((s) => s.id === id);
}

/**
 * Returns stadiums filtered by tournament tier.
 * @param {'final'|'semifinal'|'group'} tier
 * @returns {Stadium[]}
 */
export function getStadiumsByTier(tier) {
  return STADIUMS.filter((s) => s.tier === tier);
}

/**
 * Returns stadiums filtered by host country.
 * @param {string} country - 'United States' | 'Mexico' | 'Canada'
 * @returns {Stadium[]}
 */
export function getStadiumsByCountry(country) {
  return STADIUMS.filter((s) => s.country === country);
}

/**
 * Aggregate tournament-wide venue statistics, computed once at module load.
 * @type {Readonly<{totalCapacity:number, avgCapacity:number, countries:number, largest:Stadium, smallest:Stadium}>}
 */
export const VENUE_STATS = Object.freeze({
  totalCapacity: STADIUMS.reduce((sum, s) => sum + s.capacity, 0),
  avgCapacity  : Math.round(STADIUMS.reduce((sum, s) => sum + s.capacity, 0) / STADIUMS.length),
  countries    : new Set(STADIUMS.map((s) => s.country)).size,
  largest      : STADIUMS.reduce((max, s) => (s.capacity > max.capacity ? s : max), STADIUMS[0]),
  smallest     : STADIUMS.reduce((min, s) => (s.capacity < min.capacity ? s : min), STADIUMS[0]),
});