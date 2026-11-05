import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CASProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "CAS - Common Accounting System",
  description: "Balance sheet, income statement and cash flow for any business.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#187e65" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CASProvider>
          <Shell>{children}</Shell>
        </CASProvider>
      </body>
    </html>
  );
}
