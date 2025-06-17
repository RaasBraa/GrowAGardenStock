/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push('zlib-sync', 'bufferutil', 'utf-8-validate');
    return config;
  },
};

export default nextConfig; 