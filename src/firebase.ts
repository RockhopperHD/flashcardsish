import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const runtimeConfig = (globalThis as any).__FLASHCARDSISH_CONFIG__ ?? {};
const runtimeFirebaseConfig = runtimeConfig.firebase ?? {};

const isUsableConfigValue = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  return normalized !== 'undefined' && normalized !== 'null' && !normalized.startsWith('your_');
};

const resolveConfigValue = (...values: unknown[]): string => {
  for (const value of values) {
    if (isUsableConfigValue(value)) {
      return value.trim();
    }
  }
  return '';
};

const firebaseConfig = {
  // Firebase web config is public browser configuration. Protect the project with
  // Firebase security rules, App Check where appropriate, and restricted API keys.
  apiKey: resolveConfigValue(runtimeFirebaseConfig.apiKey, runtimeConfig.firebaseApiKey, import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: resolveConfigValue(runtimeFirebaseConfig.authDomain, runtimeConfig.firebaseAuthDomain, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: resolveConfigValue(runtimeFirebaseConfig.projectId, runtimeConfig.firebaseProjectId, import.meta.env.VITE_FIREBASE_PROJECT_ID),
  messagingSenderId: resolveConfigValue(runtimeFirebaseConfig.messagingSenderId, runtimeConfig.firebaseMessagingSenderId, import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: resolveConfigValue(runtimeFirebaseConfig.appId, runtimeConfig.firebaseAppId, import.meta.env.VITE_FIREBASE_APP_ID),
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
