import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-3">📚</div>
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">ไม่พบหน้านี้</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-1">Page not found</p>
        <p className="text-[var(--text-muted)] text-xs mb-6">
          ลิงก์อาจผิดพลาดหรือหน้านี้ถูกย้ายไปแล้ว · This link may be broken or the page moved.
        </p>
        <Link
          href="/trade"
          className="inline-block py-2.5 px-6 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #87A8A4, #A67C9C)' }}
        >
          กลับหน้าแรก · Go home
        </Link>
      </div>
    </main>
  );
}
