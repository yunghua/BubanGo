import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "BubanGo — 臨時缺班補人平台",
  description: "讓飲料店、小吃店快速找到臨時補班人力",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#e85d04",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
        {/* Build/version marker — bottom padding clears the fixed BottomNav + safe area */}
        <footer className="mx-auto max-w-md px-4 pt-8 pb-[calc(5.5rem_+_env(safe-area-inset-bottom))] text-center text-xs text-text-muted">
          BubanGo v0.1.6-concurrency-and-capacity-guards
        </footer>
      </body>
    </html>
  );
}
