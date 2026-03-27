import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reliable Tradies — Operations Dashboard",
  description: "Business intelligence dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" async />
        <script src="https://cdn.jsdelivr.net/npm/flatpickr" async />
      </head>
      <body>{children}</body>
    </html>
  );
}
