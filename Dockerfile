# syntax=docker/dockerfile:1

# ---------- 依赖层 ----------
FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 构建层 ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 站点名在 build 时被内联进客户端产物（layout.tsx 读 process.env.NEXT_PUBLIC_APP_NAME），
# 运行时再改无效；不传则用下面的默认值。
ARG NEXT_PUBLIC_APP_NAME=记忆引擎
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- 运行层 ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# 只拷 standalone 里运行必需的几项。
# 不能 `COPY standalone ./`：Next 16 的 standalone 目录里会混进构建机上的
# .env.local / .git / storage / tmp / _delivery（本仓库实测 436MB → 64MB）。
COPY --from=builder /app/.next/standalone/server.js ./server.js
COPY --from=builder /app/.next/standalone/package.json ./package.json
COPY --from=builder /app/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/.next/standalone/.next ./.next
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 持久卷挂载点。预先建好目录，未挂卷时也能启动（数据落在容器层，重启即失）。
RUN mkdir -p /app/storage

EXPOSE 3000

# K8s / Docker 会把 HOSTNAME 注入成容器 ID 或 Pod 名，standalone 的 server.js 会拿它当
# 监听地址（const hostname = process.env.HOSTNAME || '0.0.0.0'），结果是绑不上端口。
# 这里显式覆盖成 0.0.0.0；exec 让 node 接管 PID 1，SIGTERM 能正常优雅退出。
CMD ["sh", "-c", "exec env HOSTNAME=0.0.0.0 node server.js"]
