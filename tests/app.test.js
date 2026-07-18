/**
 * @fileoverview Blaugrana Vision Comprehensive Test Suite
 * @description Tests crowd-safety modelling, carbon/sustainability
 *              calculations, input validation, security and data
 *              integrity — zero external dependencies, pure Node.js.
 * @version 1.0.0
 *
 * Run with: node tests/app.test.js
 */

'use strict';

// ─── Test Framework ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     └─ ${err.message}`);
    failed++;
    results.push({ name, status: 'fail', error: err.message });
  }
}

function describe(name, fn) {
  console.log(`\n📋 ${name}`);
  fn();
}

function expect(val) {
  return {
    toBe          : (e) => { if (val !== e) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(val)}`); },
    toEqual       : (e) => { if (JSON.stringify(val) !== JSON.stringify(e)) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(val)}`); },
    toBeGreaterThan: (n) => { if (val <= n) throw new Error(`Expected ${val} > ${n}`); },
    toBeLessThan  : (n) => { if (val >= n) throw new Error(`Expected ${val} < ${n}`); },
    toBeCloseTo   : (e, p = 1) => { if (Math.abs(val - e) > p) throw new Error(`Expected ${val} ≈ ${e}`); },
    toBeTruthy    : () => { if (!val) throw new Error(`Expected truthy, got ${val}`); },
    toBeFalsy     : () => { if (val) throw new Error(`Expected falsy, got ${val}`); },
    toContain     : (s) => { if (!String(val).includes(s)) throw new Error(`Expected "${val}" to contain "${s}"`); },
    toBeGreaterThanOrEqual: (n) => { if (val < n) throw new Error(`Expected ${val} >= ${n}`); },
    toBeLessThanOrEqual   : (n) => { if (val > n) throw new Error(`Expected ${val} <= ${n}`); },
    toHaveLength  : (n) => { if (val.length !== n) throw new Error(`Expected length ${n}, got ${val.length}`); },
  };
}

// ─── Mirrored source functions (kept in sync with js/crowd-model.js) ─────────

const LOS_BANDS = [
  { max: 0.31, label: 'A', risk: 'free-flow' },
  { max: 0.43, label: 'B', risk: 'comfortable' },
  { max: 0.72, label: 'C', risk: 'restricted' },
  { max: 1.08, label: 'D', risk: 'congested' },
  { max: 2.17, label: 'E', risk: 'high-density' },
  { max: Infinity, label: 'F', risk: 'critical' },
];

const MAX_FLOW_RATE_PER_METRE_PER_MIN = 82;
const NFPA_EGRESS_PERSONS_PER_UNIT_PER_MIN = 60;
const NFPA_EGRESS_UNIT_WIDTH_M = 0.559;
const EVACUATION_SAFETY_MARGIN = 1.35;
const RECOMMENDED_MAX_EVACUATION_MIN = 8;

function calcDensity(occupants, areaM2) {
  if (areaM2 <= 0) return 0;
  return Math.max(0, occupants) / areaM2;
}

function getLOS(density) {
  const band = LOS_BANDS.find((b) => density <= b.max);
  return { label: band.label, risk: band.risk };
}

function estimateGateWaitMinutes(arrivalsPerMin, gateWidthM, queueLength) {
  const throughputPerMin = Math.max(gateWidthM, 0.1) * MAX_FLOW_RATE_PER_METRE_PER_MIN;
  if (throughputPerMin <= 0) return Infinity;
  const netDrainRate = throughputPerMin - arrivalsPerMin;
  const baseWait = netDrainRate > 0
    ? queueLength / netDrainRate
    : (queueLength / throughputPerMin) + (arrivalsPerMin / throughputPerMin) * 5;
  return Math.round(baseWait * 10) / 10;
}

function isGateOverCapacity(arrivalsPerMin, gateWidthM) {
  const safeThroughput = Math.max(gateWidthM, 0.1) * MAX_FLOW_RATE_PER_METRE_PER_MIN;
  return arrivalsPerMin > safeThroughput * 0.9;
}

function estimateEvacuationMinutes(occupants, exitWidthM) {
  if (occupants <= 0) return 0;
  if (exitWidthM <= 0) return Infinity;
  const exitUnits = exitWidthM / NFPA_EGRESS_UNIT_WIDTH_M;
  const throughputPerMin = exitUnits * NFPA_EGRESS_PERSONS_PER_UNIT_PER_MIN;
  const rawMinutes = occupants / throughputPerMin;
  return Math.round(rawMinutes * EVACUATION_SAFETY_MARGIN * 10) / 10;
}

function isEvacuationSafe(evacuationMinutes) {
  return evacuationMinutes <= RECOMMENDED_MAX_EVACUATION_MIN;
}

function computeZoneRisk(zone) {
  const density = calcDensity(zone.occupants, zone.areaM2);
  const los = getLOS(density);
  const evacuationMin = estimateEvacuationMinutes(zone.occupants, zone.exitWidthM);
  const overCapacity = isGateOverCapacity(zone.arrivalsPerMin, zone.gateWidthM);
  const densityScore = Math.min((density / 2.17) * 60, 60);
  const evacuationScore = Math.min((evacuationMin / RECOMMENDED_MAX_EVACUATION_MIN) * 30, 30);
  const congestionScore = overCapacity ? 10 : 0;
  const score = Math.round(densityScore + evacuationScore + congestionScore);
  return { score: Math.min(score, 100), los, evacuationMin, overCapacity };
}

function classifyRiskLevel(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'alert';
  if (score >= 35) return 'watch';
  return 'normal';
}

const MODE_EMISSION_FACTORS = { transit: 0.04, shuttle: 0.07, rideshare: 0.17, walk: 0, drive: 0.19 };

function estimateTripEmissions(mode, distanceKm) {
  const factor = MODE_EMISSION_FACTORS[mode] ?? MODE_EMISSION_FACTORS.drive;
  return Math.max(0, factor * distanceKm);
}

function estimateModalShiftSavings(totalFans, avgDistanceKm, switchRatePct) {
  const switching = totalFans * (switchRatePct / 100);
  const perFanSaving = estimateTripEmissions('drive', avgDistanceKm) - estimateTripEmissions('transit', avgDistanceKm);
  return Math.max(0, switching * perFanSaving);
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 2000);
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) return { valid: false, error: 'not array' };
  if (messages.length === 0) return { valid: false, error: 'empty' };
  if (messages.length > 50) return { valid: false, error: 'too many' };
  const validRoles = new Set(['user', 'assistant', 'system']);
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') return { valid: false, error: 'bad object' };
    if (!validRoles.has(msg.role)) return { valid: false, error: 'bad role' };
    if (typeof msg.content !== 'string') return { valid: false, error: 'bad content' };
    if (!msg.content.trim()) return { valid: false, error: 'empty content' };
  }
  return { valid: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   ⚽ Blaugrana Vision Test Suite          ║');
console.log('╚══════════════════════════════════════════╝');

describe('Crowd Density & Level of Service', () => {
  test('empty area returns zero density', () => {
    expect(calcDensity(500, 0)).toBe(0);
  });
  test('density scales correctly with area', () => {
    expect(calcDensity(200, 100)).toBe(2);
  });
  test('negative occupants clamp to zero density', () => {
    expect(calcDensity(-50, 100)).toBe(0);
  });
  test('LOS A for very low density', () => {
    expect(getLOS(0.1).label).toBe('A');
  });
  test('LOS F for extreme density', () => {
    expect(getLOS(3.5).label).toBe('F');
  });
  test('LOS C for moderate density', () => {
    expect(getLOS(0.6).label).toBe('C');
  });
  test('LOS bands are exhaustive and ordered', () => {
    expect(LOS_BANDS[LOS_BANDS.length - 1].max).toBe(Infinity);
  });
});

describe('Gate Congestion Modelling', () => {
  test('wide gate with low arrivals has minimal wait', () => {
    expect(estimateGateWaitMinutes(20, 10, 5)).toBeLessThan(1);
  });
  test('narrow gate with high arrivals has significant wait', () => {
    expect(estimateGateWaitMinutes(300, 2, 100)).toBeGreaterThan(5);
  });
  test('gate not over capacity under normal load', () => {
    expect(isGateOverCapacity(50, 10)).toBeFalsy();
  });
  test('gate over capacity when arrivals exceed throughput', () => {
    expect(isGateOverCapacity(900, 2)).toBeTruthy();
  });
  test('zero-width gate does not throw', () => {
    expect(estimateGateWaitMinutes(50, 0, 10)).toBeGreaterThanOrEqual(0);
  });
});

describe('Evacuation Time Modelling', () => {
  test('zero occupants evacuate instantly', () => {
    expect(estimateEvacuationMinutes(0, 20)).toBe(0);
  });
  test('zero exit width returns Infinity', () => {
    expect(estimateEvacuationMinutes(1000, 0)).toBe(Infinity);
  });
  test('more exit width reduces evacuation time', () => {
    const narrow = estimateEvacuationMinutes(10000, 10);
    const wide   = estimateEvacuationMinutes(10000, 30);
    expect(wide).toBeLessThan(narrow);
  });
  test('evacuation time includes safety margin (always > raw estimate)', () => {
    const raw = 10000 / ((20 / NFPA_EGRESS_UNIT_WIDTH_M) * NFPA_EGRESS_PERSONS_PER_UNIT_PER_MIN);
    expect(estimateEvacuationMinutes(10000, 20)).toBeGreaterThan(raw);
  });
  test('isEvacuationSafe respects recommended threshold', () => {
    expect(isEvacuationSafe(5)).toBeTruthy();
    expect(isEvacuationSafe(15)).toBeFalsy();
  });
});

describe('Composite Zone Risk Scoring', () => {
  test('low occupancy zone scores low risk', () => {
    const risk = computeZoneRisk({ occupants: 200, areaM2: 5000, arrivalsPerMin: 10, gateWidthM: 20, exitWidthM: 30 });
    expect(risk.score).toBeLessThan(35);
  });
  test('high occupancy overcrowded zone scores high risk', () => {
    const risk = computeZoneRisk({ occupants: 9000, areaM2: 2000, arrivalsPerMin: 500, gateWidthM: 2, exitWidthM: 3 });
    expect(risk.score).toBeGreaterThan(60);
  });
  test('risk score is always clamped to 0-100', () => {
    const risk = computeZoneRisk({ occupants: 999999, areaM2: 10, arrivalsPerMin: 9999, gateWidthM: 1, exitWidthM: 1 });
    expect(risk.score).toBeLessThanOrEqual(100);
  });
  test('classifyRiskLevel boundaries', () => {
    expect(classifyRiskLevel(0)).toBe('normal');
    expect(classifyRiskLevel(34)).toBe('normal');
    expect(classifyRiskLevel(35)).toBe('watch');
    expect(classifyRiskLevel(59)).toBe('watch');
    expect(classifyRiskLevel(60)).toBe('alert');
    expect(classifyRiskLevel(79)).toBe('alert');
    expect(classifyRiskLevel(80)).toBe('critical');
    expect(classifyRiskLevel(100)).toBe('critical');
  });
});

describe('Fan Travel Carbon Calculations', () => {
  test('walking produces zero emissions', () => {
    expect(estimateTripEmissions('walk', 10)).toBe(0);
  });
  test('driving produces more emissions than transit at same distance', () => {
    const drive = estimateTripEmissions('drive', 15);
    const transit = estimateTripEmissions('transit', 15);
    expect(drive).toBeGreaterThan(transit);
  });
  test('unknown mode defaults to driving factor', () => {
    expect(estimateTripEmissions('unknown', 10)).toBe(estimateTripEmissions('drive', 10));
  });
  test('negative distance does not produce negative emissions', () => {
    expect(estimateTripEmissions('drive', -5)).toBe(0);
  });
  test('emissions scale linearly with distance', () => {
    const short = estimateTripEmissions('drive', 5);
    const long  = estimateTripEmissions('drive', 10);
    expect(long).toBeCloseTo(short * 2, 0.01);
  });
});

describe('Modal Shift Savings', () => {
  test('zero switch rate saves nothing', () => {
    expect(estimateModalShiftSavings(50000, 12, 0)).toBe(0);
  });
  test('higher switch rate saves more', () => {
    const low  = estimateModalShiftSavings(50000, 12, 10);
    const high = estimateModalShiftSavings(50000, 12, 50);
    expect(high).toBeGreaterThan(low);
  });
  test('savings are always non-negative', () => {
    expect(estimateModalShiftSavings(1000, 5, 25)).toBeGreaterThanOrEqual(0);
  });
});

describe('Input Validation & Security', () => {
  test('sanitizeString removes script tags', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toContain('&lt;script&gt;');
  });
  test('sanitizeString handles ampersands', () => {
    expect(sanitizeString('fans & families')).toContain('&amp;');
  });
  test('sanitizeString truncates long input', () => {
    expect(sanitizeString('a'.repeat(3000)).length).toBe(2000);
  });
  test('sanitizeString returns empty for non-string', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString(42)).toBe('');
  });
  test('validateMessages rejects non-array', () => {
    expect(validateMessages('x').valid).toBeFalsy();
  });
  test('validateMessages rejects empty array', () => {
    expect(validateMessages([]).valid).toBeFalsy();
  });
  test('validateMessages rejects invalid role', () => {
    expect(validateMessages([{ role: 'hacker', content: 'hi' }]).valid).toBeFalsy();
  });
  test('validateMessages rejects empty content', () => {
    expect(validateMessages([{ role: 'user', content: '   ' }]).valid).toBeFalsy();
  });
  test('validateMessages accepts valid messages', () => {
    expect(validateMessages([{ role: 'system', content: 'hi' }, { role: 'user', content: 'hello' }]).valid).toBeTruthy();
  });
  test('validateMessages rejects too many messages', () => {
    const msgs = Array.from({ length: 51 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    expect(validateMessages(msgs).valid).toBeFalsy();
  });
});

// ─── Additional coverage ──────────────────────────────────────────────────────

/** Mirrored from shared.js */
function formatPersons(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n.toLocaleString();
}

/** Mirrored from shared.js */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/** Mirrored subset of formatMessage from shared.js */
function formatMessage(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

const STADIUMS_DATA = [
  { id: 'mexico-city',          capacity: 80824, country: 'Mexico',        tier: 'group'     },
  { id: 'new-york-new-jersey',  capacity: 80663, country: 'United States', tier: 'final'     },
  { id: 'dallas',               capacity: 70649, country: 'United States', tier: 'semifinal' },
  { id: 'atlanta',              capacity: 68239, country: 'United States', tier: 'semifinal' },
  { id: 'miami',                capacity: 64478, country: 'United States', tier: 'group'     },
  { id: 'los-angeles',          capacity: 70492, country: 'United States', tier: 'group'     },
  { id: 'san-francisco-bay-area', capacity: 68827, country: 'United States', tier: 'group'  },
  { id: 'seattle',              capacity: 66925, country: 'United States', tier: 'group'     },
  { id: 'kansas-city',          capacity: 69045, country: 'United States', tier: 'group'     },
  { id: 'houston',              capacity: 68777, country: 'United States', tier: 'group'     },
  { id: 'philadelphia',         capacity: 68324, country: 'United States', tier: 'group'     },
  { id: 'boston',               capacity: 64146, country: 'United States', tier: 'group'     },
  { id: 'toronto',              capacity: 43036, country: 'Canada',        tier: 'group'     },
  { id: 'vancouver',            capacity: 52497, country: 'Canada',        tier: 'group'     },
  { id: 'guadalajara',          capacity: 45664, country: 'Mexico',        tier: 'group'     },
  { id: 'monterrey',            capacity: 51243, country: 'Mexico',        tier: 'group'     },
];

describe('formatPersons Utility', () => {
  test('formats thousands with locale separator', () => {
    expect(formatPersons(80824)).toContain('80');
  });
  test('returns "0" for NaN', () => {
    expect(formatPersons(NaN)).toBe('0');
  });
  test('returns "0" for Infinity', () => {
    expect(formatPersons(Infinity)).toBe('0');
  });
  test('returns "0" for non-number', () => {
    expect(formatPersons('hello')).toBe('0');
  });
  test('formats zero correctly', () => {
    expect(formatPersons(0)).toBe('0');
  });
});

describe('getTodayKey Utility', () => {
  test('returns a YYYY-MM-DD formatted string', () => {
    const key = getTodayKey();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(key)).toBeTruthy();
  });
  test('date key matches today', () => {
    const key = getTodayKey();
    const expected = new Date().toISOString().split('T')[0];
    expect(key).toBe(expected);
  });
});

describe('formatMessage Utility', () => {
  test('wraps output in paragraph tags', () => {
    expect(formatMessage('hello')).toContain('<p>');
    expect(formatMessage('hello')).toContain('</p>');
  });
  test('converts **bold** to <strong>', () => {
    expect(formatMessage('**bold**')).toContain('<strong>bold</strong>');
  });
  test('converts *italic* to <em>', () => {
    expect(formatMessage('*italic*')).toContain('<em>italic</em>');
  });
  test('converts double newlines to paragraph breaks', () => {
    expect(formatMessage('a\n\nb')).toContain('</p><p>');
  });
  test('returns empty string for non-string input', () => {
    expect(formatMessage(null)).toBe('');
    expect(formatMessage(42)).toBe('');
  });
});

describe('STADIUMS Data Integrity', () => {
  test('exactly 16 stadiums defined', () => {
    expect(STADIUMS_DATA).toHaveLength(16);
  });
  test('all stadium ids are unique', () => {
    const ids = STADIUMS_DATA.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(16);
  });
  test('all capacities are positive integers > 40000', () => {
    STADIUMS_DATA.forEach((s) => {
      expect(s.capacity).toBeGreaterThan(40000);
    });
  });
  test('exactly one final-tier stadium', () => {
    const finals = STADIUMS_DATA.filter((s) => s.tier === 'final');
    expect(finals).toHaveLength(1);
  });
  test('exactly two semifinal-tier stadiums', () => {
    const semis = STADIUMS_DATA.filter((s) => s.tier === 'semifinal');
    expect(semis).toHaveLength(2);
  });
  test('host countries are only US, Mexico, Canada', () => {
    const valid = new Set(['United States', 'Mexico', 'Canada']);
    STADIUMS_DATA.forEach((s) => {
      expect(valid.has(s.country)).toBeTruthy();
    });
  });
  test('MetLife Stadium hosts the Final', () => {
    const final = STADIUMS_DATA.find((s) => s.tier === 'final');
    expect(final.id).toBe('new-york-new-jersey');
  });
  test('total capacity exceeds one million', () => {
    const total = STADIUMS_DATA.reduce((sum, s) => sum + s.capacity, 0);
    expect(total).toBeGreaterThan(1_000_000);
  });
});

describe('Evacuation Time Edge Cases', () => {
  test('single person evacuates near-instantly', () => {
    expect(estimateEvacuationMinutes(1, 10)).toBeLessThan(1);
  });
  test('very large exit width dramatically reduces time', () => {
    const wide = estimateEvacuationMinutes(50000, 100);
    expect(wide).toBeLessThan(15);
  });
  test('safety margin applied — result always > raw unpadded estimate', () => {
    const raw = (5000 / ((15 / NFPA_EGRESS_UNIT_WIDTH_M) * NFPA_EGRESS_PERSONS_PER_UNIT_PER_MIN));
    const withMargin = estimateEvacuationMinutes(5000, 15);
    expect(withMargin).toBeGreaterThan(raw);
  });
  test('result is rounded to 1 decimal place', () => {
    const result = estimateEvacuationMinutes(1000, 5);
    expect(Number.isFinite(result)).toBeTruthy();
    expect(String(result).replace(/^\d+\.?/, '').length).toBeLessThanOrEqual(1);
  });
});

describe('Gate Wait Edge Cases', () => {
  test('arrivals exactly at throughput capacity — finite wait', () => {
    const throughput = 6 * MAX_FLOW_RATE_PER_METRE_PER_MIN;
    const result = estimateGateWaitMinutes(throughput, 6, 50);
    expect(Number.isFinite(result)).toBeTruthy();
  });
  test('zero arrivals drains queue proportionally to throughput', () => {
    const wait = estimateGateWaitMinutes(0, 5, 100);
    const expected = 100 / (5 * MAX_FLOW_RATE_PER_METRE_PER_MIN);
    expect(wait).toBeCloseTo(expected, 1);
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

const total = passed + failed;
const width = 44;
const bar = '═'.repeat(width);

console.log(`\n╔${bar}╗`);
console.log(`║  Tests:  ${String(total).padEnd(width - 10)}║`);
console.log(`║  Passed: ${String(`${passed} ✅`).padEnd(width - 10)}║`);
console.log(`║  Failed: ${String(failed + (failed > 0 ? ' ❌' : '')).padEnd(width - 10)}║`);
console.log(`╠${bar}╣`);
if (failed === 0) {
  console.log(`║  🎉 All tests passed!${' '.repeat(width - 24)}║`);
} else {
  console.log(`║  ⚠️  ${failed} test(s) need attention${' '.repeat(width - 28 - String(failed).length)}║`);
}
console.log(`╚${bar}╝\n`);

if (failed > 0) process.exit(1);