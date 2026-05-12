import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Parent repo has its own package-lock; pin tracing so server chunks resolve consistently.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
