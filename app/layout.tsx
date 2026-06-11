import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { MigrationProvider } from "@/components/providers/MigrationProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SteadyTrack - Stay On Track",
    template: "%s - SteadyTrack",
  },
  description: "Track your progress, build momentum, and feel confident during the Alberta teacher strike. Build daily streaks and stay consistent with curriculum-aligned study plans.",
  keywords: ["Alberta education", "study tracker", "diploma exam prep", "student progress", "study plan", "Alberta curriculum", "high school", "teacher strike"],
  authors: [{ name: "SteadyTrack" }],
  creator: "SteadyTrack",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://www.steadytrack.ca",
    title: "SteadyTrack - Stay On Track",
    description: "Track your progress, build momentum, and feel confident during the Alberta teacher strike.",
    siteName: "SteadyTrack",
  },
  twitter: {
    card: "summary_large_image",
    title: "SteadyTrack - Stay On Track",
    description: "Track your progress, build momentum, and feel confident during the Alberta teacher strike.",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1e40af" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} antialiased overflow-x-hidden`}
      >
        <ErrorBoundary>
          <MigrationProvider>
            <QueryProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </QueryProvider>
          </MigrationProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
