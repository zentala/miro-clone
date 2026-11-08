/** @type {import('next').NextConfig} */
const nextConfig = {
    // The container runs the traced server bundle from .next/standalone.
    output: "standalone",
    experimental: {
        // Native image decoder: load it from node_modules at runtime instead of
        // bundling its .node binary; the standalone trace copies it.
        serverComponentsExternalPackages: ["@napi-rs/image"],
    },
    images: {
        // Standalone image optimization needs the native `sharp` package, which
        // is not installed; serve the few local images unchanged instead.
        unoptimized: true,
    },
};

export default nextConfig;
