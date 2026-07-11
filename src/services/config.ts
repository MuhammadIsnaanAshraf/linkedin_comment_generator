// Backend base URL. Injected at build time via webpack DefinePlugin from the
// BACKEND_URL env var, falling back to the deployed backend. Point this at
// http://localhost:3333 in extension/.env to test against a local backend.
declare const process: { env: { BACKEND_URL?: string } };

export const BACKEND_URL =
  (typeof process !== 'undefined' && process.env.BACKEND_URL) ||
  // 'http://localhost:3333';
  'https://comment-generator-scrapper.vercel.app';
