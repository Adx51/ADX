/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  // Same-origin API proxy: the browser calls `/api/*` on the web origin and
  // Next forwards to the API. This avoids CORS in dev and, crucially, lets the
  // app run behind a single-origin reverse proxy (Home Assistant Ingress).
  async rewrites() {
    const target = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
