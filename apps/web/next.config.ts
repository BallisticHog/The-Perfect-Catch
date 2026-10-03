import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
    poweredByHeader: false,
    transpilePackages: ["@the-perfect-catch/ui", "@the-perfect-catch/db", "@the-perfect-catch/domain"],
    experimental: {
        authInterrupts: true,
    },
    async headers()
    {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "same-origin" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Cache-Control", value: "private, no-store, max-age=0" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ],
            },
        ];
    },
};

export default nextConfig;
