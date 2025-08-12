// src/lib/base-url.ts
export function getBaseUrl() {
  // W przeglądarce użyj relative (działa), na serwerze zbuduj absolutny
  if (typeof window !== 'undefined') return '';
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/,'');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
