import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPECTRA FLUX — Generative Motion Studio",
  description: "SPECTRA FLUX：144 种 WebGL 单效果、随机混合实验室与本地策展首页。",
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
