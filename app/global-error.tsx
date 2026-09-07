'use client';

// Only used when the root layout itself throws — Providers, Navbar and
// globals.css may not have rendered, so this stays self-contained with inline
// styles and its own <html>/<body> rather than relying on any of that.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#EFE3D0' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😵</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#3D2A39', marginBottom: 8 }}>เกิดข้อผิดพลาดร้ายแรง</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
              Something went badly wrong. ลองรีเฟรชหน้านี้อีกครั้ง
            </p>
            <button
              onClick={reset}
              style={{
                padding: '10px 24px', borderRadius: 12, fontWeight: 700, color: '#fff',
                background: 'linear-gradient(135deg, #87A8A4, #A67C9C)', border: 'none', cursor: 'pointer',
              }}
            >
              ลองใหม่ · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
