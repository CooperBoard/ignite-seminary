import type { Metadata } from "next";
import "./globals.css";
import Header from "./header";

export const metadata: Metadata = {
  title: "Ignite Seminary",
  description: "Course hub for Ignite Church seminary students",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
