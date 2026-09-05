import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-3">📚</div>
        <h1 className="text-2xl font-bold text-[#2e1065] mb-2">ไม่พบหน้านี้</h1>
        <p className="text-[#6b7280] text-sm mb-1">Page not found</p>
        <p className="text-[#9ca3af] text-xs mb-6">
          ลิงก์อาจผิดพลาดหรือหน้านี้ถูกย้ายไปแล้ว · This link may be broken or the page moved.
        </p>
        <Link
          href="/trade"
          className="inline-block py-2.5 px-6 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          กลับหน้าแรก · Go home
        </Link>
      </div>
    </main>
  );
}
