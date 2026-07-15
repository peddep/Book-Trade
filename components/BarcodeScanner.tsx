'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Props {
  onDetected: (isbn: string) => void;
  onClose: () => void;
}

// Full-screen barcode scanner. Uses the phone camera and ZXing to read the
// ISBN barcode (EAN-13) on the back cover of a book.
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, result => {
          if (!result || doneRef.current) return;
          const text = result.getText().replace(/[^0-9Xx]/g, '');
          // ISBNs are 10 or 13 digits; book EAN-13 starts with 978/979.
          if (text.length === 13 ? /^97[89]/.test(text) : text.length === 10) {
            doneRef.current = true;
            onDetected(text);
          }
        });
      } catch {
        if (!cancelled) setError(t('scan.cameraError'));
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4" style={{ background: 'rgba(17, 6, 41, 0.92)' }}>
      <p className="text-white font-bold mb-3">📷 {t('scan.title')}</p>
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden" style={{ border: '2px solid #8b5cf6' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full" style={{ maxHeight: '55vh', objectFit: 'cover' }} />
        {/* Aiming guide */}
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 rounded-lg pointer-events-none"
          style={{ border: '2px dashed rgba(255,255,255,0.7)' }} />
      </div>
      <p className="text-xs mt-3 text-center" style={{ color: '#ddd6fe' }}>{t('scan.hint')}</p>
      {error && <p className="text-sm mt-2 text-red-300">{error}</p>}
      <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#ffffff', color: '#2e1065' }}>
        {t('scan.close')}
      </button>
    </div>
  );
}
