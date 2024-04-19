/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: 'build', output: 'export', basePath: '/agoric-oracle-viewer', assetPrefix: '/agoric-oracle-viewer',
    images: { unoptimized: true }
}

module.exports = nextConfig
