/**
 * @fileoverview Firebase configuration and service exports for Blaugrana Vision
 * @description Initialises Firebase app, Firestore, Auth, and Google
 *              provider. Client config is safe to commit — it is a public
 *              identifier, not a secret; access is enforced by Firebase
 *              Security Rules server-side.
 * @module firebase
 */

'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

/**
 * Firebase client-side configuration. Replace with your own project's
 * config from the Firebase console before deploying.
 * @see https://firebase.google.com/docs/projects/api-keys
 * @type {import('firebase/app').FirebaseOptions}
 */
const FIREBASE_CONFIG = Object.freeze({
  apiKey           : 'AIzaSyC-PcCQjxDuLHIudjYeORyLxpKTW7C4Y-k',
  authDomain       : 'blaugrana-vision.firebaseapp.com',
  projectId        : 'blaugrana-vision',
  storageBucket    : 'blaugrana-vision.firebasestorage.app',
  messagingSenderId: '751514984857',
  appId            : '1:751514984857:web:6dfd52b98d292597b33308',
  measurementId    : 'G-QKCXP3M8T3',
});

const app      = initializeApp(FIREBASE_CONFIG);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

export { db, auth, provider };