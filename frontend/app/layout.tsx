import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SURI — Adaptive Math Learning",
  description:
    "Adaptive mathematics learning application for Philippine Junior High School students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-black min-h-screen">
        {children}
      </body>
    </html>
  );
}
