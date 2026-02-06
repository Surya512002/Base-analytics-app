/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com', // Good to have for other PFPs
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;