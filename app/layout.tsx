import type { Metadata } from "next";
import "./globals.css";
import Header from "./header";

export const metadata: Metadata = {
  metadataBase: new URL("https://ignitemb-lms.vercel.app"),
  title: "Ignite Seminary",
  description: "Biblical Training · Missions · Church Planting — course hub for Ignite Church seminary students",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Ignite Seminary",
    description: "Biblical Training · Missions · Church Planting",
    images: ["/logo.png"],
  },
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
