import type { Metadata } from "next";
import { Noto_Serif_Thai } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// Headings on the front page only. A Thai-capable serif is what makes that
// page read as print rather than as an app; the rest of the site stays on the
// system sans it already uses.
const serif = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  weight: ["600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BookTrade — Student Book Trading",
  description: "Trade books with other students at your school",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={serif.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
