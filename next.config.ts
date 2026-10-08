import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // dev 与 build 各用一份产物目录。否则 next build 重写 .next/*.json 时，
  // 运行中的 dev server 会读到半个文件，报
  // "Failed to generate static paths for …" + "Unexpected end of JSON input"。
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    // BUG-11：src/proxy.ts（Next 16 的 proxy，即原 middleware）在转发前会克隆请求体，
    // 这一克隆有硬上限，默认 10MB（node_modules/next/dist/server/body-streams.js），
    // 超限即静默截断 —— 下游 request.formData() 于是抛 undici 的
    // "Failed to parse body as FormData."，18MB 级的 WAV 因此传不上去。
    // 取 110MB：覆盖 src/lib/server/upload-store.ts 的 100MB 业务上限，
    // 余额留给 multipart 边界与同请求的表单字段。
    // 该值会被写进构建产物（.next/required-server-files.json），生产环境改完必须重新
    // next build；dev 下重启 dev server 即生效。
    proxyClientMaxBodySize: "110mb",
  },
};

export default nextConfig;