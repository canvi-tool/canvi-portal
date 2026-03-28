/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase requires runtime env vars, disable static page generation
  output: undefined,
  experimental: {},
};

export default nextConfig;
