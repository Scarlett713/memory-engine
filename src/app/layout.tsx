import type { Metadata } from "next";

import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "记忆引擎";

export const metadata: Metadata = {
  title: `${appName} | 口述历史采集与整理工作台`,
  description:
    "面向口述史业务的数智化处理平台，覆盖音视频转写、整理与脱敏、人工校定与档案导出全链条。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

