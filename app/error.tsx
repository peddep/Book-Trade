'use client';

import { useEffect } from 'react';

// Catches a render/data error anywhere under this segment so a bug shows the
// student a page they can act on, instead of Next's default blank error
// screen with no way back into the app.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled page error:', error);
  }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-3">😵</div>
        <h1 className="text-2xl font-bold text-[#2e1065] mb-2">เกิดข้อผิดพลาด</h1>
        <p className="text-[#6b7280] text-sm mb-6">
          Something went wrong. ลองใหม่อีกครั้ง หรือกลับหน้าแรก
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="py-2.5 px-6 rounded-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            ลองใหม่ · Try again
          </button>
          <a
            href="/trade"
            className="py-2.5 px-6 rounded-xl font-bold text-[#4b5563]"
            style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
          >
            หน้าแรก · Home
          </a>
        </div>
      </div>
    </main>
  );
}
