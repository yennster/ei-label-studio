import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { WorkspaceUnicornDecor } from "@/components/unicorn-decor";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Absolute base for OG/Twitter image URLs. Vercel sets the production URL in
// prod; falls back to an explicit override, then localhost in dev.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

const description =
  "Pull samples from your Edge Impulse project, relabel them in an embedded Label Studio canvas, and push every correction straight back — driven by shareable URLs.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "EI Label Studio — label your Edge Impulse data",
  description,
  openGraph: {
    type: "website",
    siteName: "EI · Label Studio",
    title: "EI · Label Studio — your Edge Impulse data, labeled and ready",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "EI · Label Studio — your Edge Impulse data, labeled and ready",
    description,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark", "unicorn"]}
        >
          {children}
          <WorkspaceUnicornDecor />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
