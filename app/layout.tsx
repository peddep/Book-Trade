import type { Metadata } from "next";
import { Noto_Serif_Thai } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

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
  title: "เล่มแลกเล่ม (LemLaekLem) — แลกหนังสือกับเพื่อนในโรงเรียน",
  description: "แลกเปลี่ยนหนังสือกับเพื่อน ๆ ในโรงเรียน · Trade books with other students at your school",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

// Vercel sets VERCEL_ENV to 'preview' on branch deployments and 'production'
// on the live site. Read on the server, so it costs nothing on the client and
// cannot be wrong. The banner only ever exists on a preview.
function PreviewBanner() {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  return (
    <div style={{
      background: '#b45309', color: '#ffffff', textAlign: 'center',
      padding: '4px 12px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
    }}>
      🧪 เว็บทดสอบ — ไม่ใช่เว็บจริง · TEST SITE — not the real เล่มแลกเล่ม
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={serif.variable}>
      <body>
        {/* Telling the test site apart from the real one at a glance is the
            difference between poking at a preview and editing students' data. */}
        <PreviewBanner />
        {/* The navbar lives here rather than in each page, so switching pages
            keeps the same header instead of tearing it down and building a new
            one — which meant re-fetching the session, the notification list and
            the offers badge on every single tap. */}
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
