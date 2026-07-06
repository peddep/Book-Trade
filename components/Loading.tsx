'use client';

// Centered purple spinner shown while a screen loads.
export default function Loading({ full = true }: { full?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${full ? 'min-h-[60vh]' : 'py-16'}`}>
      <div
        className="rounded-full animate-spin"
        style={{
          width: 44,
          height: 44,
          border: '4px solid #e9d5ff',
          borderTopColor: '#7c3aed',
        }}
      />
      <span className="text-2xl animate-pulse">📚</span>
    </div>
  );
}
