import type { Metadata } from "next";

import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "记忆引擎";

export const metadata: Metadata = {
  title: `${appName} | AI赋能口述式抢救与文化传承`,
  description:
    "面向口述史业务的数智化处理平台，覆盖音视频转写、整理与脱敏、人工校定与档案导出全链条。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-scroll-behavior 告知 Next 路由切换时临时关掉平滑滚动：globals.css 里
    // html { scroll-behavior: smooth } 会让路由回顶变成一段可见的滑动，且会触发 dev 警告。
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

