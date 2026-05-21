import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audio Transcript Trimmer",
  description: "AI-powered transcript cutter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
