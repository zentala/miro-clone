/** @type {import('next').NextConfig} */
const nextConfig = {
    // The container runs the traced server bundle from .next/standalone.
    output: "standalone",
    images: {
        // Standalone image optimization needs the native `sharp` package, which
        // is not installed; serve the few local images unchanged instead.
        unoptimized: true,
    },
};

export default nextConfig;
