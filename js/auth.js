/**
 * @fileoverview Google Authentication module for Blaugrana Vision
 * @description Wraps Firebase Auth for fans, volunteers and organisers.
 * @module auth
 */

'use strict';

import { auth, provider } from './firebase.js';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

/**
 * Registers authentication state callbacks.
 * @param {function(import('firebase/auth').User): void} onLogin
 * @param {function(): void} onLogout
 * @returns {function(): void} Unsubscribe function
 */
export function initAuth(onLogin, onLogout) {
  return onAuthStateChanged(auth, (user) => {
    if (user) onLogin(user);
    else onLogout();
  });
}

/**
 * Opens a Google sign-in popup.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error('[Auth] Sign-in failed:', err.code, err.message);
    throw err;
  }
}

/**
 * Signs the current user out.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('[Auth] Sign-out failed:', err.code, err.message);
    throw err;
  }
}

/**
 * Returns the currently authenticated user, or null.
 * @returns {import('firebase/auth').User|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}