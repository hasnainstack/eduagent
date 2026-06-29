/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — no server needed, files go to out/
  output: "export",
  // Skip image optimization (requires server)
  images: { unoptimized: true },
  // Avoid trailing slash redirects
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
