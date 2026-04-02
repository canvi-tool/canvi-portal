/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase requires runtime env vars, disable static page generation
  output: undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
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
