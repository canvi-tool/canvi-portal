/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase requires runtime env vars, disable static page generation
  output: undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
