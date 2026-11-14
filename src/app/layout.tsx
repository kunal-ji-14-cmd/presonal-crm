import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nexus AI CRM", description: "One workspace for every customer relationship." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}