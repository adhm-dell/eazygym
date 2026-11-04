/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gym/ui", "@gym/mock-data", "@gym/domain", "@gym/contracts", "@gym/i18n"],
  reactStrictMode: true,
};

export default nextConfig;

