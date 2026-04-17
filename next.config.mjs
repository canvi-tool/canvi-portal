/** @type {import('next').NextConfig} */
// Canonical host redirect is env-var gated so that deploying before DNS/domain
// is ready does not brick the site. When CANONICAL_HOST is unset, no redirect
// is registered. When set (e.g. "portal.canvi.co.jp"), requests hitting the
// *.vercel.app host are 308-redirected to the canonical host.
const CANONICAL_HOST = process.env.CANONICAL_HOST?.trim() || '';

const nextConfig = {
  // Supabase requires runtime env vars, disable static page generation
  output: undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async redirects() {
    if (!CANONICAL_HOST) return [];
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: '(.*)\\.vercel\\.app' }],
        destination: `https://${CANONICAL_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // XSS Protection
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Clickjacking Protection
          { key: 'X-Frame-Options', value: 'DENY' },
          // HTTPS Only (HSTS)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Referrer Policy - 個人情報URLパラメータ漏洩防止
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions Policy - 不要なブラウザ機能を無効化
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // XSS Protection (Legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is required by Next.js for certain runtime features
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
      {
        // 本人確認書類・機密ファイルへのキャッシュ無効化
        source: '/api/staff/:id/documents',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
