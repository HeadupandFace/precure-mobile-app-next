// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
// We are deliberately NOT importing './globals.css' or './tailwind.css' here
// as we will load Tailwind directly from a CDN.

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Precure Mobile App", // You can customize this
  description: "Onboarding System by Precure", // You can customize this
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* THIS IS THE CRUCIAL LINE: Tailwind CSS from CDN */}
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
        {/* Note: This is an older, but widely compatible, Tailwind CDN version. */}
        {/* It might not have the absolute latest classes, but it should provide basic styling. */}
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}