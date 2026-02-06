import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/docs/getting-started",
        destination: "/docs/get-started",
        permanent: true
      },
      {
        source: "/en/docs/getting-started",
        destination: "/en/docs/get-started",
        permanent: true
      }
    ];
  },
  outputFileTracingRoot: path.join(process.cwd(), "..")
};

export default nextConfig;
