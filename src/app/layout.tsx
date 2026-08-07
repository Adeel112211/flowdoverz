import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FloatingContact } from "@/components/floating-contact";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlowDoverz — Google Flow AI video workspace",
  description:
    "FlowDoverz connects your browser to Google Flow for cinematic AI video creation — secure sessions, team seats, and workspace management in one place.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden font-sans text-slate-100 bg-black">
        {children}
        <FloatingContact />
      </body>
    </html>
  );
}
