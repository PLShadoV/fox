/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NIE używamy static export. Pozostaw pusty obiekt jeśli nic nie potrzebujesz.
  // Brak experimental.appDir (w 14.x jest domyślnie).
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
};

module.exports = nextConfig;
