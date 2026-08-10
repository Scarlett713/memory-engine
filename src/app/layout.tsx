import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

import "./globals.css";

const sans = Noto_Sans_SC({
  variable: "--font-body",
  weight: ["400", "500", "700"],
  preload: false,
});

const serif = Noto_Serif_SC({
  variable: "--font-display",
  weight: ["500", "700"],
  preload: false,
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "记忆引擎";

export const metadata: Metadata = {
  title: `${appName} | 口述历史采集与整理工作台`,
  description:
    "面向口述历史场景的提纲生成、音频转写、AI整理、人工审校与档案导出工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}

