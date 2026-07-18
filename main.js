// ============================================
//   BLAUGRANA VISION — MAIN JS
//   Particle animation + nav + auth + venue stats
// ============================================

'use strict';

import { initAuth, loginWithGoogle, logout } from './js/auth.js';
import { throttleRaf, formatPersons } from './js/shared.js';
import { STADIUMS, VENUE_STATS } from './js/stadiums-data.js';

// ---- PARTICLE CANVAS ----
const canvas = document.getElementById('particleCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const handleResize = throttleRaf(() => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  });
  window.addEventListener('resize', handleResize);

  const SYMBOLS = ['⚽', '🏟️', '🌍', '🎟️', '🚆', '♿'];
  const particles = [];

  class Particle {
    constructor(initial = false) { this.reset(initial); }
    reset(initial = false) {
      this.x        = Math.random() * canvas.width;
      this.y        = initial ? Math.random() * canvas.height : -30;
      this.size     = Math.random() * 14 + 8;
      this.speed    = Math.random() * 0.6 + 0.2;
      this.opacity  = Math.random() * 0.35 + 0.08;
      this.rotation = Math.random() * 360;
      this.rotSpeed = (Math.random() - 0.5) * 1.2;
      this.drift    = (Math.random() - 0.5) * 0.4;
      this.symbol   = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    }
    update() {
      this.y        += this.speed;
      this.x        += this.drift;
      this.rotation += this.rotSpeed;
      if (this.y > canvas.height + 40) this.reset();
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.globalAlpha = this.opacity;
      ctx.font = `${this.size}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.symbol, 0, 0);
      ctx.restore();
    }
  }

  for (let i = 0; i < 45; i++) particles.push(new Particle(true));

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  };
  animate();
}

// ---- VENUE STATS (landing page) ----
function renderVenueStats() {
  const grid = document.getElementById('venueStatsGrid');
  if (!grid) return;

  const cards = [
    { icon: '🏟️', label: 'Largest Venue', value: VENUE_STATS.largest.commonName, sub: `${formatPersons(VENUE_STATS.largest.capacity)} capacity` },
    { icon: '📊', label: 'Total Capacity', value: formatPersons(VENUE_STATS.totalCapacity), sub: 'seats across all venues' },
    { icon: '🌎', label: 'Host Nations', value: String(VENUE_STATS.countries), sub: 'USA · Mexico · Canada' },
    { icon: '🏆', label: 'The Final', value: STADIUMS.find((s) => s.tier === 'final')?.commonName ?? '—', sub: 'July 19, 2026' },
  ];

  grid.innerHTML = cards.map((c) => `
    <div class="meter-card">
      <div class="meter-icon" aria-hidden="true">${c.icon}</div>
      <h4>${c.label}</h4>
      <p><strong>${c.value}</strong></p>
      <p style="font-size:0.8rem;color:var(--text-muted)">${c.sub}</p>
    </div>`).join('');
}
renderVenueStats();

// ---- AUTH ----
const loginBtn   = document.getElementById('loginBtn');
const userInfo   = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userName   = document.getElementById('userName');

loginBtn?.addEventListener('click', async () => {
  try {
    await loginWithGoogle();
  } catch (err) {
    console.error('[Auth] Login failed:', err.message);
  }
});

window.handleLogout = async function handleLogout() {
  try {
    await logout();
  } catch (err) {
    console.error('[Auth] Logout failed:', err.message);
  }
};

initAuth(
  (user) => {
    loginBtn?.classList.add('hidden');
    userInfo?.classList.remove('hidden');
    if (userAvatar) { userAvatar.src = user.photoURL; userAvatar.alt = `${user.displayName} profile picture`; }
    if (userName)   userName.textContent = user.displayName?.split(' ')[0] ?? 'Fan';
  },
  () => {
    loginBtn?.classList.remove('hidden');
    userInfo?.classList.add('hidden');
  },
);

// ---- NAVBAR SCROLL ----
const handleScroll = throttleRaf(() => {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  if (window.scrollY > 40) {
    nav.style.padding    = '0.75rem 2.5rem';
    nav.style.background = 'rgba(10,10,12,0.98)';
  } else {
    nav.style.padding    = '1rem 2.5rem';
    nav.style.background = 'rgba(10,10,12,0.85)';
  }
});
window.addEventListener('scroll', handleScroll);

// ---- CARD ANIMATIONS ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.animation = `fadeInUp 0.6s ${i * 0.1}s ease both`;
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .meter-card').forEach((el) => {
  el.style.opacity = '0';
  observer.observe(el);
});