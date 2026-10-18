import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpsClock | Physical Operations Observability",
  description:
    "Measure physical response latency, monitor loading dock operations, and detect SLA breaches with OpsClock.",
  applicationName: "OpsClock",
  openGraph: {
    title: "OpsClock | Physical Operations Observability",
    description:
      "Software teams measure API latency. OpsClock measures physical latency.",
    url: "https://opsclock-rho.vercel.app",
    siteName: "OpsClock",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
