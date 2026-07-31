import withPWAInit from "@serwist/next";

const withPWA = withPWAInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV !== "production",
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
