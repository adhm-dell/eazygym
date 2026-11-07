/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gym/ui", "@gym/mock-data", "@gym/domain", "@gym/contracts", "@gym/i18n"],
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:4000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
