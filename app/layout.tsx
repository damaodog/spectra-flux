import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPECTRA FLUX — Generative Motion Atlas",
  description: "SPECTRA FLUX 光谱流域：三十六种 WebGL 色彩动态实验。",
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
