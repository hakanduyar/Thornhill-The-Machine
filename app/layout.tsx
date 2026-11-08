import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Thornhill Machine",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

/** Full-viewport scene layout. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><link rel="preload" href={process.env.NEXT_PUBLIC_SCENE_PRELOAD_URL} as="fetch" crossOrigin="anonymous" /></head>
      <body>{children}</body>
    </html>
  );
}
