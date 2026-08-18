import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base con cui Next rende assoluti gli URL relativi nei metadata (le
  // copertine passate a openGraph.images sono path tipo "/uploads/xxx.png").
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Broken Panel — Comic Publishing",
    // Le pagine figlie impostano solo il proprio titolo (es. "Dracula") e
    // Next ci costruisce intorno questo template.
    template: "%s — Broken Panel",
  },
  description:
    "Broken Panel turns great literary classics into AI-generated comics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
