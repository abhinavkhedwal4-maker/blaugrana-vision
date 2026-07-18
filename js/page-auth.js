/**
 * @fileoverview Shared auth wiring for sub-pages
 * @description Wires the Sign In / Sign Out buttons and user-info panel on
 *              every page that includes the nav-right auth controls. Mirrors
 *              the same logic used in main.js for the home page.
 * @module page-auth
 */

'use strict';

import { initAuth, loginWithGoogle, logout } from './auth.js';

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
    if (userAvatar) {
      userAvatar.src = user.photoURL ?? '';
      userAvatar.alt = `${user.displayName} profile picture`;
    }
    if (userName) userName.textContent = user.displayName?.split(' ')[0] ?? 'Fan';
  },
  () => {
    loginBtn?.classList.remove('hidden');
    userInfo?.classList.add('hidden');
  },
);
