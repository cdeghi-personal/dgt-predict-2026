import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.sydle.one' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
}

export default nextConfig
