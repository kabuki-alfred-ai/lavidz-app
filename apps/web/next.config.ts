import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Allow large video uploads through API routes (default is 10MB)
  middlewareClientMaxBodySize: 536870912, // 512MB in bytes
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
    '@remotion/core',
    'esbuild',
  ],
  async headers() {
    return [
      {
        // COOP on all routes (safe — doesn't block cross-origin resources)
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        // COEP only on the processing route that needs FFmpeg.wasm / SharedArrayBuffer
        source: '/process(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ]
  },
}

export default nextConfig
