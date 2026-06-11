import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.sydle.one' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
}

export default nextConfig
