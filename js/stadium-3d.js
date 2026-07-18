/**
 * @fileoverview Procedural 3D stadium visualisation engine
 * @description Renders an interactive, explorable 3D model of any FIFA World
 *              Cup 2026 venue using Three.js. Geometry is generated
 *              procedurally from each stadium's `shape`, `roofType`,
 *              `capacity`, `elevationM` and `country` fields — giving each
 *              of the 16 venues a distinct visual identity without loading
 *              external model files.
 *
 * Visual differentiation layers (innermost → outermost):
 *   1. Per-stadium material palette  — unique tier/roof colours per venue id
 *   2. roofType geometry             — open trusses / retractable sliding
 *                                      half-panels / fixed solid canopy
 *   3. shape geometry                — bowl rings / dome hemisphere shell /
 *                                      horseshoe arc with end-stand walls
 *   4. Elevation environment         — high-altitude haze + mountains,
 *                                      or coastal blue ambient + sea plane
 *   5. Stadium landmarks             — one signature 3D prop per venue
 *
 * @module stadium-3d
 */

'use strict';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Geometry constants ───────────────────────────────────────────────────────

/** Base radius (world units) of the innermost pitch-side seating ring */
const INNER_RADIUS = 34;

/** Radial gap between the pitch surface and the first seating tier */
const PITCH_MARGIN = 6;

/** Height (world units) of each seating tier */
const TIER_HEIGHT = 9;

/** Radial depth (world units) of each seating tier */
const TIER_DEPTH = 16;

/** Number of discrete seating tiers rendered (lower / club / upper) */
const TIER_COUNT = 3;

/** Segment count used for radial geometry */
const RADIAL_SEGMENTS = 64;

/** Pitch dimensions in world units (FIFA regulation ratio, scaled) */
const PITCH_WIDTH  = 68 * 0.5;
const PITCH_LENGTH = 105 * 0.5;

/** Camera fly-to animation duration in milliseconds */
const CAMERA_TRANSITION_MS = 1200;

/** Elevation threshold above which high-altitude environment is applied (metres) */
const HIGH_ALT_M = 1500;

/** Elevation threshold below which coastal environment is applied (metres) */
const COASTAL_M = 30;

// ─── Occupancy colours ────────────────────────────────────────────────────────

/** Occupancy heat-map colour stops */
const OCCUPANCY_COLORS = Object.freeze({
  low     : 0x22c55e,
  medium  : 0xeab308,
  high    : 0xf97316,
  critical: 0xef4444,
});

// ─── Fix 3: Per-stadium material palettes ────────────────────────────────────

/**
 * Colour palette for a stadium — drives tier fill, structural ring, and
 * roof canopy tint.  All 16 venues have an explicit entry; a `default` entry
 * is the fallback.
 *
 * @typedef {{ tier: number[], ring: number, roof: number }} StadiumPalette
 *   tier  — array of three hex colours for lower / club / upper tiers
 *   ring  — structural roof-ring metal colour
 *   roof  — canopy tint colour (used for fixed/retractable roofs)
 */
const STADIUM_PALETTES = Object.freeze({
  // ── Mexico ─────────────────────────────────────────────────────────────────
  'mexico-city'  : { tier: [0x3a2a1a, 0x2e2214, 0x221a0e], ring: 0xd4a843, roof: 0x006847 },
  'guadalajara'  : { tier: [0x2a1a1a, 0x221414, 0x1a0e0e], ring: 0xc8a040, roof: 0x7a1e1e },
  'monterrey'    : { tier: [0x1e2a2a, 0x162020, 0x0e1818], ring: 0x9ebdbd, roof: 0x1a4466 },

  // ── United States ──────────────────────────────────────────────────────────
  'new-york-new-jersey'  : { tier: [0x1a1e2e, 0x141828, 0x0e121e], ring: 0x3b82f6, roof: 0xd0ddf8 },
  'dallas'               : { tier: [0x2a1a1a, 0x201414, 0x180e0e], ring: 0xb0b8c8, roof: 0xc0c8d8 },
  'atlanta'              : { tier: [0x1e1a2a, 0x181420, 0x120e18], ring: 0xa09ab8, roof: 0x7060a8 },
  'miami'                : { tier: [0x1a2a2a, 0x142020, 0x0e1818], ring: 0xf97316, roof: 0x0ea5e9 },
  'los-angeles'          : { tier: [0x1e1e2a, 0x181820, 0x121218], ring: 0xc8c040, roof: 0xe8e4c0 },
  'san-francisco-bay-area': { tier: [0x1a2620, 0x141e18, 0x0e1812], ring: 0x6aad6a, roof: 0xb0e0b0 },
  'seattle'              : { tier: [0x1a2030, 0x141828, 0x0e1220], ring: 0x4a9a6a, roof: 0xd0ecd8 },
  'kansas-city'          : { tier: [0x2a1a1a, 0x201414, 0x180e0e], ring: 0xe83030, roof: 0xffd700 },
  'houston'              : { tier: [0x1e2218, 0x181c12, 0x12160c], ring: 0xd4b840, roof: 0xb8d0b0 },
  'philadelphia'         : { tier: [0x1a2020, 0x141818, 0x0e1010], ring: 0x4a7ca8, roof: 0xa8c0d8 },
  'boston'               : { tier: [0x1a2030, 0x141828, 0x0e1220], ring: 0x2050a0, roof: 0xb0c8e8 },

  // ── Canada ─────────────────────────────────────────────────────────────────
  'toronto'  : { tier: [0x2a1a1a, 0x201414, 0x180e0e], ring: 0xcc0000, roof: 0xf0c0c0 },
  'vancouver': { tier: [0x1a2030, 0x141828, 0x0e1220], ring: 0x4488cc, roof: 0xc8ddf8 },

  // ── Fallback ───────────────────────────────────────────────────────────────
  default: { tier: [0x1a2e1a, 0x14241a, 0x0f1c14], ring: 0x2a3b2a, roof: 0xcfe8d8 },
});

/**
 * Returns the palette for a given stadium id, falling back to default.
 * @param {string} id
 * @returns {StadiumPalette}
 */
function getPalette(id) {
  return STADIUM_PALETTES[id] ?? STADIUM_PALETTES.default;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a fully-configured Three.js stadium scene for a given venue.
 * Caller is responsible for appending `renderer.domElement` to the DOM and
 * driving the render loop via the returned `tick()` function.
 *
 * @param {HTMLElement} container - DOM element the canvas will be sized to
 * @param {import('./stadiums-data.js').Stadium} stadium - Venue data
 * @returns {{
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   renderer: THREE.WebGLRenderer,
 *   controls: any,
 *   tick: function(): void,
 *   setZoneOccupancy: function(number, number): void,
 *   flyToZone: function(number): void,
 *   dispose: function(): void
 * }}
 */
export function createStadiumScene(container, stadium) {
  // ── Fix 4: scene background driven by elevation ──────────────────────────
  const isHighAlt = stadium.elevationM >= HIGH_ALT_M;
  const isCoastal = stadium.elevationM <= COASTAL_M;

  let bgColor, fogColor;
  if (isHighAlt)      { bgColor = 0x0d1018; fogColor = 0x1a2030; }
  else if (isCoastal) { bgColor = 0x080c14; fogColor = 0x081828; }
  else                { bgColor = 0x0a0f0a; fogColor = 0x0a0f0a; }
  const fogDensity = isHighAlt ? 0.0055 : 0.0038;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog        = new THREE.FogExp2(fogColor, fogDensity);

  const camera   = createCamera(container);
  const renderer = createRenderer(container);
  container.appendChild(renderer.domElement);

  addLighting(scene, stadium);
  addEnvironment(scene, stadium);
  addPitch(scene);

  const tierGroups = buildSeatingBowl(scene, stadium);
  addRoof(scene, stadium);
  buildLandmark(scene, stadium);

  const controls = createOrbitControls(camera, renderer.domElement);

  /** Renders one frame and advances controls damping. */
  function tick() {
    controls.update();
    renderer.render(scene, camera);
  }

  /**
   * Recolors a seating tier to reflect live occupancy percentage.
   * @param {number} tierIndex     - 0 (lower), 1 (club), 2 (upper)
   * @param {number} occupancyPct  - 0–100
   */
  function setZoneOccupancy(tierIndex, occupancyPct) {
    const group = tierGroups[tierIndex];
    if (!group) return;
    const color = occupancyToColor(occupancyPct);
    group.traverse((obj) => {
      if (obj.isMesh) obj.material.color.setHex(color);
    });
  }

  /**
   * Smoothly animates the camera to a framing shot of the requested tier.
   * @param {number} tierIndex - 0 (lower), 1 (club), 2 (upper)
   */
  function flyToZone(tierIndex) {
    const radius = INNER_RADIUS + PITCH_MARGIN + tierIndex * TIER_DEPTH + TIER_DEPTH / 2;
    const height = 20 + tierIndex * TIER_HEIGHT * 1.4;
    animateCamera(camera, { x: radius * 0.7, y: height, z: radius * 0.7 });
  }

  /** Releases GPU resources — call when navigating away from the 3D view. */
  function dispose() {
    controls.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  return { scene, camera, renderer, controls, tick, setZoneOccupancy, flyToZone, dispose };
}

// ─── Camera & renderer setup ──────────────────────────────────────────────────

/**
 * Creates and positions the perspective camera for the default overview shot.
 * @param {HTMLElement} container
 * @returns {THREE.PerspectiveCamera}
 */
function createCamera(container) {
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000);
  camera.position.set(120, 90, 120);
  camera.lookAt(0, 10, 0);
  return camera;
}

/**
 * Creates a WebGL renderer sized to the container with sensible defaults.
 * @param {HTMLElement} container
 * @returns {THREE.WebGLRenderer}
 */
function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  return renderer;
}

/**
 * Creates OrbitControls with comfortable interaction limits.
 * @param {THREE.Camera} camera
 * @param {HTMLElement} domElement
 * @returns {OrbitControls}
 */
function createOrbitControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance   = 40;
  controls.maxDistance   = 260;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 10, 0);
  return controls;
}

// ─── Fix 4: Lighting driven by elevation / coastal context ───────────────────

/**
 * Adds ambient + directional + floodlight lighting.
 * High-altitude stadiums get a cooler, slightly hazy ambient.
 * Coastal stadiums get a softer blue-tinted ambient.
 *
 * @param {THREE.Scene} scene
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function addLighting(scene, stadium) {
  const isHighAlt = stadium.elevationM >= HIGH_ALT_M;
  const isCoastal = stadium.elevationM <= COASTAL_M;

  let ambientColor, sunColor;
  if (isHighAlt)      { ambientColor = 0xd0d8f0; sunColor = 0xffeedd; }
  else if (isCoastal) { ambientColor = 0xc8d8f8; sunColor = 0xddeeff; }
  else                { ambientColor = 0xffffff; sunColor = 0xfff4e0; }
  const ambientIntensity = isHighAlt ? 0.48 : 0.55;

  const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
  scene.add(ambient);

  const sunColorVal = sunColor;
  const sun = new THREE.DirectionalLight(sunColorVal, 1.1);
  sun.position.set(80, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  // Four corner floodlight rigs
  const floodColor = isCoastal ? 0xd8eeff : 0xe8f5e9;
  [[110, 60, 110], [-110, 60, 110], [110, 60, -110], [-110, 60, -110]].forEach(([x, y, z]) => {
    const flood = new THREE.PointLight(floodColor, 0.4, 260);
    flood.position.set(x, y, z);
    scene.add(flood);
  });
}

// ─── Fix 4: Environment geometry ─────────────────────────────────────────────

/**
 * Adds environment-specific background geometry:
 *  - High altitude (≥1500m): hazy distant mountain silhouettes
 *  - Coastal (≤30m):         distant sea-glint plane + horizon haze
 *
 * @param {THREE.Scene} scene
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function addEnvironment(scene, stadium) {
  if (stadium.elevationM >= HIGH_ALT_M) {
    // Mountain silhouettes — a ring of low-poly cones at large distance
    const mtColors = [0x1a2030, 0x151a28, 0x1e2838];
    const mtDefs = [
      { r: 380, a: 0.18 * Math.PI,  h: 120, w: 90 },
      { r: 420, a: 0.55 * Math.PI,  h: 160, w: 110 },
      { r: 360, a: 0.85 * Math.PI,  h: 100, w: 80 },
      { r: 400, a: 1.20 * Math.PI,  h: 140, w: 100 },
      { r: 440, a: 1.60 * Math.PI,  h: 130, w: 120 },
      { r: 390, a: 1.90 * Math.PI,  h: 110, w: 85 },
      { r: 370, a: -0.30 * Math.PI, h: 150, w: 95 },
      { r: 450, a: -0.70 * Math.PI, h: 125, w: 105 },
    ];
    mtDefs.forEach(({ r, a, h, w }, i) => {
      const geo = new THREE.ConeGeometry(w, h, 5);
      const mat = new THREE.MeshStandardMaterial({
        color: mtColors[i % mtColors.length],
        roughness: 1.0,
        flatShading: true,
      });
      const mt = new THREE.Mesh(geo, mat);
      mt.position.set(Math.cos(a) * r, h * 0.15, Math.sin(a) * r);
      scene.add(mt);
    });
  } else if (stadium.elevationM <= COASTAL_M) {
    // Distant ocean plane — large flat quad far behind the camera target
    const seaGeo = new THREE.PlaneGeometry(800, 400);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x0a2a4a,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.55,
    });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -2, -420);
    scene.add(sea);
  }
}

// ─── Pitch ────────────────────────────────────────────────────────────────────

/**
 * Adds the pitch surface with FIFA regulation line markings drawn via a
 * canvas texture.
 * @param {THREE.Scene} scene
 */
function addPitch(scene) {
  const texture  = buildPitchTexture();
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
  const geometry = new THREE.PlaneGeometry(PITCH_LENGTH * 2, PITCH_WIDTH * 2);

  const pitch = new THREE.Mesh(geometry, material);
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);
}

/**
 * Draws a regulation football pitch onto a canvas and returns it as a texture.
 * @returns {THREE.CanvasTexture}
 */
function buildPitchTexture() {
  const canvas = document.createElement('canvas');
  canvas.width  = 1024;
  canvas.height = 683;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e5c2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stripeWidth = canvas.width / 12;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 12; i += 2) {
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, canvas.height);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth   = 3;

  const margin = 24;
  ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, margin);
  ctx.lineTo(canvas.width / 2, canvas.height - margin);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  [margin, canvas.width - margin].forEach((x, i) => {
    const dir = i === 0 ? 1 : -1;
    ctx.strokeRect(x + dir * -1, canvas.height / 2 - 132, dir * 132, 264);
    ctx.strokeRect(x + dir * -1, canvas.height / 2 - 60,  dir * 55,  120);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// ─── Fix 1 + Fix 3: Seating bowl ─────────────────────────────────────────────

/**
 * Builds the multi-tier seating bowl with shape-specific geometry and
 * per-stadium palette colours.
 *
 * shape 'bowl'      — standard full-arc concentric rings
 * shape 'dome'      — same rings but with dome-specific tier height scaling
 * shape 'horseshoe' — 82% arc, gap faces +Z, end-stand walls cap both arc ends
 *
 * @param {THREE.Scene} scene
 * @param {import('./stadiums-data.js').Stadium} stadium
 * @returns {THREE.Group[]} One group per tier (index 0 = lower tier)
 */
function buildSeatingBowl(scene, stadium) {
  const palette = getPalette(stadium.id);
  const groups  = [];

  const isHorseshoe = stadium.shape === 'horseshoe';
  const isDome      = stadium.shape === 'dome';

  // Horseshoe: 82% arc gap centred on +Z (open end faces the camera's default angle)
  // Arc starts at offset so the midpoint of the gap is at +Z.
  const arcFraction   = isHorseshoe ? 0.82 : 1;
  const arcTotal      = Math.PI * 2 * arcFraction;
  const gapHalf       = Math.PI * 2 * (1 - arcFraction) / 2;
  // Start angle: offset so the open gap is symmetric around +Z (i.e., π/2)
  const arcStart      = isHorseshoe ? Math.PI / 2 + gapHalf : 0;

  // Dome tiers are slightly taller and steeper for an enclosed feel
  let tierHeightMul;
  if (isDome)        tierHeightMul = 1.3;
  else if (isHorseshoe) tierHeightMul = 1.25;
  else               tierHeightMul = 1.15;

  for (let tier = 0; tier < TIER_COUNT; tier++) {
    const innerR = INNER_RADIUS + PITCH_MARGIN + tier * TIER_DEPTH;
    const outerR = innerR + TIER_DEPTH - 1.2;
    const yBase  = tier * TIER_HEIGHT * tierHeightMul;
    const tH     = isDome ? TIER_HEIGHT * 1.1 : TIER_HEIGHT;

    const group = new THREE.Group();
    group.name  = `tier-${tier}`;

    // Seating ring surface
    const ringGeo = new THREE.RingGeometry(innerR, outerR, RADIAL_SEGMENTS, 1, arcStart, arcTotal);
    const ringMat = new THREE.MeshStandardMaterial({
      color: palette.tier[tier], side: THREE.DoubleSide, roughness: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = yBase + tH * (tier + 1) * 0.35;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);

    // Retaining wall behind the seating (cylindrical arc)
    const wallGeo = new THREE.CylinderGeometry(
      outerR, outerR - 3, tH, RADIAL_SEGMENTS, 1, true, arcStart, arcTotal,
    );
    const wallMat = new THREE.MeshStandardMaterial({
      color: palette.tier[tier], side: THREE.BackSide, roughness: 0.95,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = yBase + tH * (tier + 1) * 0.35 + tH / 2;
    group.add(wall);

    // ── Horseshoe: end-stand walls capping both open ends of the arc ─────────
    if (isHorseshoe) {
      const wallW = outerR - innerR;
      const wallH = tH * 0.9;
      const wallD = 2.5;

      [-1, 1].forEach((side) => {
        // Angle of the arc end on this side
        const endAngle = arcStart + (side === 1 ? arcTotal : 0);
        const midR     = (innerR + outerR) / 2;

        const capGeo = new THREE.BoxGeometry(wallW, wallH, wallD);
        const capMat = new THREE.MeshStandardMaterial({
          color: palette.tier[tier], roughness: 0.9,
        });
        const cap = new THREE.Mesh(capGeo, capMat);

        // Position at the arc end, oriented tangentially
        cap.position.set(
          Math.cos(endAngle) * midR,
          ring.position.y + wallH / 2,
          Math.sin(endAngle) * midR,
        );
        // Face tangent to the arc (perpendicular to the radius at this point)
        cap.rotation.y = -endAngle + Math.PI / 2;
        group.add(cap);
      });
    }

    scene.add(group);
    groups.push(group);
  }

  return groups;
}

// ─── Fix 1 + Fix 2 + Fix 3: Roof ─────────────────────────────────────────────

/**
 * Adds shape- and roofType-aware roof geometry with per-stadium colour.
 *
 * roofType 'open'        — structural ring + 8 radiating strut arms (no canopy)
 * roofType 'retractable' — two half-disc canopy panels offset apart (mid-slide)
 * roofType 'fixed'       — full solid canopy disc, per-stadium tint
 *
 * shape 'dome' (any roofType != open) — adds a translucent upper hemisphere
 *                                       shell over everything
 *
 * @param {THREE.Scene} scene
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function addRoof(scene, stadium) {
  const palette = getPalette(stadium.id);
  const outerR  = INNER_RADIUS + PITCH_MARGIN + TIER_COUNT * TIER_DEPTH;
  const isDome  = stadium.shape === 'dome';
  let tierHeightMul;
  if (isDome)                          tierHeightMul = 1.3;
  else if (stadium.shape === 'horseshoe') tierHeightMul = 1.25;
  else                                 tierHeightMul = 1.15;
  const roofY   = TIER_COUNT * TIER_HEIGHT * tierHeightMul + 14;

  // ── Structural ring (all types) ───────────────────────────────────────────
  const ringGeo = new THREE.TorusGeometry(outerR + 4, 1.4, 12, RADIAL_SEGMENTS);
  const ringMat = new THREE.MeshStandardMaterial({
    color: palette.ring, metalness: 0.6, roughness: 0.4,
  });
  const structuralRing = new THREE.Mesh(ringGeo, ringMat);
  structuralRing.rotation.x = Math.PI / 2;
  structuralRing.position.y = roofY;
  scene.add(structuralRing);

  if (stadium.roofType === 'open') {
    // ── Fix 2 open: exposed truss arms radiating from ring ─────────────────
    addOpenTrusswork(scene, outerR, roofY, palette.ring);

  } else if (stadium.roofType === 'retractable') {
    // ── Fix 2 retractable: two half-disc panels slid apart ──────────────────
    addRetractableCanopy(scene, outerR, roofY, palette.roof);

  } else {
    // ── Fix 2 fixed: full solid canopy ──────────────────────────────────────
    const canopyGeo = new THREE.CircleGeometry(outerR + 2, RADIAL_SEGMENTS);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: palette.roof,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      roughness: 0.35,
      metalness: 0.15,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.rotation.x = -Math.PI / 2;
    canopy.position.y = roofY - 1;
    scene.add(canopy);
  }

  // ── Fix 1 dome: upper hemisphere shell ────────────────────────────────────
  if (isDome && stadium.roofType !== 'open') {
    addDomeShell(scene, outerR, roofY, palette.roof);
  }
}

/**
 * Adds 8 radiating strut arms for open-roof stadiums — makes them look
 * structurally distinct from roofed venues even without a canopy.
 *
 * @param {THREE.Scene} scene
 * @param {number} outerR  - outer bowl radius
 * @param {number} roofY   - roof height
 * @param {number} color   - strut hex colour
 */
function addOpenTrusswork(scene, outerR, roofY, color) {
  const strutCount = 8;
  const strutLen   = outerR + 4;
  const strutMat   = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.35 });

  for (let i = 0; i < strutCount; i++) {
    const angle = (i / strutCount) * Math.PI * 2;

    // Diagonal arm from bowl edge up to a point above centre
    const strutGeo = new THREE.CylinderGeometry(0.6, 0.6, strutLen, 6);
    const strut    = new THREE.Mesh(strutGeo, strutMat);

    // Centre the cylinder halfway along its length
    const cx = Math.cos(angle) * strutLen / 2;
    const cz = Math.sin(angle) * strutLen / 2;
    strut.position.set(cx, roofY + 8, cz);

    // Tilt outward and down
    strut.rotation.z = Math.PI / 2;
    strut.rotation.y = -angle;

    scene.add(strut);

    // Vertical mast at the outer tip
    const mastGeo = new THREE.CylinderGeometry(0.5, 0.5, 18, 6);
    const mast    = new THREE.Mesh(mastGeo, strutMat);
    mast.position.set(Math.cos(angle) * (outerR + 4), roofY + 3, Math.sin(angle) * (outerR + 4));
    scene.add(mast);
  }
}

/**
 * Adds two semi-circular canopy panels offset apart (retractable roof mid-slide).
 * Each half-disc is shifted outward along its diameter axis so there's a visible
 * gap between them — Dallas/Atlanta/Houston/Vancouver are instantly recognisable.
 *
 * @param {THREE.Scene} scene
 * @param {number} outerR   - outer bowl radius
 * @param {number} roofY    - roof height
 * @param {number} color    - canopy tint hex colour
 */
function addRetractableCanopy(scene, outerR, roofY, color) {
  const panelMat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    roughness: 0.3,
    metalness: 0.2,
  });

  // Each half is a half-disc (π arc), offset outward by panelSlide units
  const panelSlide = outerR * 0.22; // how far each panel has slid open

  for (const side of [-1, 1]) {
    // Half-circle: start at 0, sweep π
    const halfGeo = new THREE.CircleGeometry(outerR + 2, RADIAL_SEGMENTS, 0, Math.PI);
    const panel   = new THREE.Mesh(halfGeo, panelMat.clone());
    panel.rotation.x = -Math.PI / 2;
    // Rotate so the flat edge is along the X axis, then offset along Z
    panel.rotation.z = side === 1 ? 0 : Math.PI;
    panel.position.set(0, roofY - 1, side * panelSlide);
    scene.add(panel);

    // Retractable panel guide rails — thin boxes along the panel diameter
    const railMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    for (const railOff of [-outerR * 0.6, 0, outerR * 0.6]) {
      const railGeo = new THREE.BoxGeometry(outerR * 0.08, 1.0, (outerR + 2) * 2);
      const rail    = new THREE.Mesh(railGeo, railMat);
      rail.position.set(railOff, roofY + 1.5, side * panelSlide * 0.5);
      scene.add(rail);
    }
  }
}

/**
 * Adds a translucent upper-hemisphere shell for dome stadiums — sits above
 * all tiers and creates a clearly enclosed silhouette.
 *
 * @param {THREE.Scene} scene
 * @param {number} outerR  - outer bowl radius
 * @param {number} roofY   - base height for the dome equator
 * @param {number} color   - dome tint hex colour
 */
function addDomeShell(scene, outerR, roofY, color) {
  // Upper hemisphere: radius slightly larger than the bowl footprint
  const domeR  = outerR * 1.08;
  const domeGeo = new THREE.SphereGeometry(
    domeR,
    RADIAL_SEGMENTS,
    24,          // height segments — enough for smooth arc
    0,           // phiStart
    Math.PI * 2, // phiLength (full 360°)
    0,           // thetaStart — top of sphere
    Math.PI / 2, // thetaLength — upper hemisphere only
  );
  const domeMat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.2,
    metalness: 0.1,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  // Position so the equator of the sphere sits at roofY
  dome.position.y = roofY;
  scene.add(dome);

  // Inner structural lattice ring at the dome equator
  const latticeMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 16; i++) {
    const a  = (i / 16) * Math.PI * 2;
    const ribGeo = new THREE.CylinderGeometry(0.4, 0.4, domeR, 4);
    const rib    = new THREE.Mesh(ribGeo, latticeMat);
    rib.position.set(Math.cos(a) * domeR * 0.5, roofY + domeR * 0.5, Math.sin(a) * domeR * 0.5);
    rib.rotation.z = Math.PI / 2;
    rib.rotation.y = -a;
    scene.add(rib);
  }
}

// ─── Fix 5: Per-stadium landmark ─────────────────────────────────────────────

/**
 * Adds a single signature 3D prop that makes the venue instantly recognisable
 * at a glance. Keyed by stadium.id; no-op for unrecognised ids.
 *
 * @param {THREE.Scene} scene
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function buildLandmark(scene, stadium) {
  switch (stadium.id) {
    case 'dallas':
      addDallasScoreboard(scene);
      break;
    case 'guadalajara':
      addGuadalajaraShell(scene);
      break;
    case 'seattle':
    case 'kansas-city':
      // Steep acoustic upper tier — handled by tierHeightMul; add extra corner towers
      addAcousticTowers(scene, stadium.id);
      break;
    case 'atlanta':
    case 'houston':
      // Extra visible roof-panel guide rails to reinforce retractable identity
      addRetractableRails(scene);
      break;
    default:
      break;
  }
}

/**
 * Dallas AT&T Stadium — giant centre-hung scoreboard (Jerry World halo board).
 * A wide flat box suspended above midfield on support cables.
 */
function addDallasScoreboard(scene) {
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.6 });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x002244,
    emissive: 0x001133,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });

  // Halo-board frame: thin flattened box
  const boardGeo = new THREE.BoxGeometry(60, 2.5, 14);
  const board    = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0, 52, 0);
  scene.add(board);

  // Screen faces on four sides of the board
  [
    { w: 60, h: 12, pos: [0, 52, 7],  ry: 0 },
    { w: 60, h: 12, pos: [0, 52, -7], ry: Math.PI },
    { w: 14, h: 12, pos: [30, 52, 0], ry: Math.PI / 2 },
    { w: 14, h: 12, pos: [-30, 52, 0], ry: -Math.PI / 2 },
  ].forEach(({ w, h, pos, ry }) => {
    const screenGeo = new THREE.PlaneGeometry(w, h);
    const screen    = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(...pos);
    screen.rotation.y = ry;
    scene.add(screen);
  });

  // Support cables — thin cylinders from board corners to ring
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9 });
  const outerR   = INNER_RADIUS + PITCH_MARGIN + TIER_COUNT * TIER_DEPTH + 4;
  [
    [-28, 52, 0, 0.35 * Math.PI],
    [ 28, 52, 0, 0.65 * Math.PI],
    [-28, 52, 0, -0.35 * Math.PI],
    [ 28, 52, 0, -0.65 * Math.PI],
  ].forEach(([bx, by, bz, angle]) => {
    const tx = Math.cos(angle) * outerR;
    const ty = TIER_COUNT * TIER_HEIGHT * 1.3 + 14;
    const tz = Math.sin(angle) * outerR;
    const dx = tx - bx, dy = ty - by, dz = tz - bz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const cableGeo = new THREE.CylinderGeometry(0.3, 0.3, len, 4);
    const cable    = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set((bx + tx) / 2, (by + ty) / 2, (bz + tz) / 2);
    cable.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, dy / len, dz / len),
    );
    scene.add(cable);
  });
}

/**
 * Guadalajara Estadio Akron — distinctive spherical outer coliseum shell.
 * A low-opacity sphere wrapping the entire structure.
 */
function addGuadalajaraShell(scene) {
  const outerR  = INNER_RADIUS + PITCH_MARGIN + TIER_COUNT * TIER_DEPTH;
  const shellR  = outerR * 1.18;
  const shellGeo = new THREE.SphereGeometry(shellR, RADIAL_SEGMENTS, 20);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x6a2a1a,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    roughness: 0.6,
    wireframe: false,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.y = shellR * 0.3;
  scene.add(shell);

  // Outer structural rib arches
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x8a3a22, metalness: 0.4, roughness: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ribGeo = new THREE.TorusGeometry(shellR, 0.8, 6, 32, Math.PI);
    const rib    = new THREE.Mesh(ribGeo, ribMat);
    rib.position.y = shellR * 0.3;
    rib.rotation.y = a;
    scene.add(rib);
  }
}

/**
 * Seattle/Kansas City — four tall corner acoustic towers to reinforce the
 * horseshoe's sound-trap reputation.
 */
function addAcousticTowers(scene, stadiumId) {
  const outerR   = INNER_RADIUS + PITCH_MARGIN + TIER_COUNT * TIER_DEPTH;
  const towerH   = TIER_COUNT * TIER_HEIGHT * 1.4;
  const color    = stadiumId === 'seattle' ? 0x2a5a3a : 0xcc2222;
  const towerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 });

  // Three towers at the closed end of the horseshoe (angles away from the +Z gap)
  [-0.5, 0, 0.5].forEach((offset) => {
    const angle = Math.PI + offset * 0.6; // opposite side from gap
    const geo   = new THREE.BoxGeometry(4, towerH, 4);
    const tower = new THREE.Mesh(geo, towerMat);
    tower.position.set(Math.cos(angle) * (outerR + 6), towerH / 2, Math.sin(angle) * (outerR + 6));
    scene.add(tower);
  });
}

/**
 * Atlanta/Houston — extra horizontal guide rails across the retractable gap,
 * reinforcing the sliding-panel roof identity.
 */
function addRetractableRails(scene) {
  const outerR   = INNER_RADIUS + PITCH_MARGIN + TIER_COUNT * TIER_DEPTH;
  const roofY    = TIER_COUNT * TIER_HEIGHT * 1.3 + 14;
  const railMat  = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.85, roughness: 0.2 });

  for (let i = -1; i <= 1; i++) {
    const railGeo = new THREE.BoxGeometry((outerR + 2) * 2, 0.8, 1.2);
    const rail    = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, roofY + 2 + i * 3, i * (outerR * 0.28));
    scene.add(rail);
  }
}

// ─── Occupancy → colour mapping ───────────────────────────────────────────────

/**
 * Maps an occupancy percentage to a heat-map colour hex value.
 * @param {number} pct - Occupancy percentage (0–100)
 * @returns {number} Hex color
 */
function occupancyToColor(pct) {
  if (pct >= 92) return OCCUPANCY_COLORS.critical;
  if (pct >= 75) return OCCUPANCY_COLORS.high;
  if (pct >= 40) return OCCUPANCY_COLORS.medium;
  return OCCUPANCY_COLORS.low;
}

// ─── Camera animation ─────────────────────────────────────────────────────────

/**
 * Smoothly interpolates the camera position to a target over CAMERA_TRANSITION_MS.
 * @param {THREE.Camera} camera
 * @param {{x:number, y:number, z:number}} target
 */
function animateCamera(camera, target) {
  const start     = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t       = Math.min(elapsed / CAMERA_TRANSITION_MS, 1);
    const eased   = 1 - (1 - t) ** 3; // ease-out cubic

    camera.position.set(
      start.x + (target.x - start.x) * eased,
      start.y + (target.y - start.y) * eased,
      start.z + (target.z - start.z) * eased,
    );

    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/**
 * Handles container resize — call from a window resize listener.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {HTMLElement} container
 */
export function resizeStadiumScene(camera, renderer, container) {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
