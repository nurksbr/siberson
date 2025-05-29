/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Force HTTPS redirects to be disabled in development
    forceSwcTransforms: false,
  },
  // Disable HTTPS redirect in development
  async redirects() {
    return [];
  },
  images: {
    domains: ['placehold.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'http',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Configure server options
  env: {
    CUSTOM_KEY: 'development'
  },
  // Next.js 15+ sürümünde appDir artık varsayılan olarak etkinleştirilmiştir
};

module.exports = nextConfig;