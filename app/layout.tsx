import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookTrade — Student Book Trading",
  description: "Trade books with other students at your school",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
