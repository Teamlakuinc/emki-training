/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
};
export default nextConfig;
