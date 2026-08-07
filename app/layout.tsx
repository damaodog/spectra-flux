import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMA LAB — WebGL Card Generator",
  description: "在线生成并复制可嵌入网页的 WebGL 动态卡片。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
