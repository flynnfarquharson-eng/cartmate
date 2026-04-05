import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "CartMate - Shared Grocery Orders",
  description: "A shared grocery ordering platform for share houses",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        <div className="mx-auto max-w-lg min-h-screen">
          <AuthGate>{children}</AuthGate>
        </div>
      </body>
    </html>
  );
}
