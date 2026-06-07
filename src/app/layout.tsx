import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque, Unbounded } from "next/font/google";
import "./globals.css";
import StdbProvider from "@/components/StdbProvider";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Characterful display face for headings + the wordmark (body stays Geist).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// Display face for the Starblox wordmark (the brand type).
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Starblox",
  description:
    "Multiplayer games made and remade by talking to AI — live on SpacetimeDB.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${unbounded.variable}`}>
      <body>
        <StdbProvider>
          <AppShell>{children}</AppShell>
        </StdbProvider>
      </body>
    </html>
  );
}
