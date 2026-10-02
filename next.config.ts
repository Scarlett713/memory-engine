import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // dev 与 build 各用一份产物目录。否则 next build 重写 .next/*.json 时，
  // 运行中的 dev server 会读到半个文件，报
  // "Failed to generate static paths for …" + "Unexpected end of JSON input"。
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;