import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Astrix | Swap with Intent",
  description:
    "The intent-centric execution layer on Hedera. Sign off-chain, settle on-chain—MEV-resistant ordering via HCS and atomic HTS settlement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`xy-html ${geistSans.variable} ${geistMono.variable} ${outfit.variable}`}>
      <body className="xy-body">{children}</body>
    </html>
  );
}
