import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "WHNP Board Prep", template: "%s · WHNP Board Prep" },
  description: "Private study quiz.",
  // Private site: keep it out of search engines (also enforced by robots.txt and X-Robots-Tag).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header
          className="gutter sticky top-0 z-20 flex items-center gap-6 border-b border-line bg-surface/90 backdrop-blur"
          style={{ height: "var(--header-h)" }}
        >
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <svg
              aria-hidden
              viewBox="0 0 32 32"
              className="h-8 w-8 text-accent"
            >
              <rect width="32" height="32" rx="2" fill="currentColor" />
              <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="var(--accent-text)" />
            </svg>
            WHNP Board Prep
          </Link>
          <div className="ml-auto">
            <Nav />
          </div>
        </header>
        <main className="gutter w-full py-6 pb-28 sm:py-8 xl:pb-20">{children}</main>
      </body>
    </html>
  );
}
