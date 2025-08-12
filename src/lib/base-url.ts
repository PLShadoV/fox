export function getBaseUrl() {
  if (typeof window !== 'undefined') return ''; // w przeglądarce używamy ścieżek względnych
  const url =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;
  if (url && /^https?:\/\//i.test(url)) return url;
  if (url) return `https://${url}`;
  return 'http://localhost:3000';
}
