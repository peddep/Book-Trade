'use client';

interface Props {
  coverUrl?: string | null;
  coverColor: string;
  size?: number; // px
}

// Small square book thumbnail: real cover when available, colored 📖 otherwise.
export default function BookThumb({ coverUrl, coverColor, size = 32 }: Props) {
  return (
    <div
      className="rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ background: coverColor, width: size, height: size, fontSize: size * 0.5 }}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <span>📖</span>
      )}
    </div>
  );
}
