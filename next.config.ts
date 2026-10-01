import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prompt templates are plain-text files read at runtime; make sure Vercel ships them.
  outputFileTracingIncludes: {
    "/**": ["./lib/ai/prompts/**/*.txt"],
  },
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "unpdf"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
