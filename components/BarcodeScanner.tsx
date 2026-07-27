'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Props {
  onDetected: (isbn: string) => void;
  onClose: () => void;
  // When set, the camera stays open after a successful scan so the student can
  // photograph the front cover — the only way to get a cover when the book
  // APIs have nothing (or are refusing us).
  onCapture?: (dataUrl: string) => void;
  // Result of the parent's lookup: 'pending' while it runs, 'have' if it
  // already produced a cover (nothing to photograph), 'need' if it did not.
  coverStatus?: 'pending' | 'have' | 'need';
}

function isIsbn(text: string): string | null {
  const t = text.replace(/[^0-9Xx]/g, '');
  if (t.length === 13 && /^97[89]/.test(t)) return t;
  if (t.length === 10) return t;
  return null;
}

// Full-screen ISBN barcode scanner. Prefers the phone's native
// BarcodeDetector (fast and reliable on Android/Chrome); falls back to ZXing.
// Always requests the BACK camera at a usable resolution — the previous
// version often got the front camera, which is why scanning was hit-or-miss.
export default function BarcodeScanner({ onDetected, onClose, onCapture, coverStatus = 'need' }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'scan' | 'cover'>('scan');
  const doneRef = useRef(false);

  // Nothing left to photograph once the lookup produced a cover of its own.
  useEffect(() => {
    if (phase === 'cover' && coverStatus === 'have') onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, coverStatus]);

  // Grabs the current video frame, cropped to a portrait book-cover shape and
  // scaled to roughly the size an uploaded photo ends up at.
  function capture() {
    const video = videoRef.current;
    if (!video || !onCapture) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const RATIO = 2 / 3; // width : height of a typical book cover
    let sw = vw;
    let sh = vh;
    if (vw / vh > RATIO) sw = Math.round(vh * RATIO);
    else sh = Math.round(vw / RATIO);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    const outW = 400;
    const outH = Math.round(outW / RATIO);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
    onCapture(canvas.toDataURL('image/jpeg', 0.72));
    onClose();
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let zxingControls: { stop: () => void } | null = null;
    let cancelled = false;

    function found(text: string) {
      const isbn = isIsbn(text);
      if (!isbn || doneRef.current) return false;
      doneRef.current = true;
      onDetected(isbn);
      // Keep the camera running for the cover shot; with no capture handler
      // there is nothing left to do here.
      if (onCapture) setPhase('cover');
      else onClose();
      return true;
    }

    async function start() {
      const video = videoRef.current;
      if (!video) return;

      // Back camera, decent resolution — critical for reading small barcodes.
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      // Path 1: native BarcodeDetector (Chrome/Android — fast and reliable).
      const BD = (window as any).BarcodeDetector;
      let detector: any = null;
      if (BD) {
        try {
          const formats: string[] = await BD.getSupportedFormats();
          if (formats.includes('ean_13')) {
            detector = new BD({ formats: ['ean_13', 'ean_8'].filter(f => formats.includes(f)) });
          }
        } catch { /* fall back to ZXing */ }
      }

      if (detector) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          video.srcObject = stream;
          await video.play();
          const tick = async () => {
            if (cancelled || doneRef.current) return;
            try {
              const codes = await detector.detect(video);
              for (const c of codes) if (found(c.rawValue)) return;
            } catch { /* frame not ready */ }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          return;
        } catch {
          // camera failed for native path — try ZXing below
          stream?.getTracks().forEach(t => t.stop());
          stream = null;
        }
      }

      // Path 2: ZXing with EAN-only hints + TRY_HARDER (works on iOS Safari).
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled) return;
        zxingControls = await reader.decodeFromConstraints(constraints, video, result => {
          if (result) found(result.getText());
        });
      } catch {
        if (!cancelled) setError(t('scan.cameraError'));
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      zxingControls?.stop();
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coverPhase = phase === 'cover';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4" style={{ background: 'rgba(17, 6, 41, 0.92)' }}>
      <p className="text-white font-bold mb-3">{coverPhase ? `✓ ${t('scan.coverStep')}` : `📷 ${t('scan.title')}`}</p>
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden" style={{ border: '2px solid #8b5cf6' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="w-full" style={{ maxHeight: '55vh', objectFit: 'cover' }} />
        {/* Aiming guide: a barcode strip while scanning, a cover-shaped frame after */}
        {coverPhase ? (
          // Dimming everything outside the frame keeps the guide readable
          // against a white book cover, where a white outline would vanish.
          <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 rounded-lg pointer-events-none"
            style={{ aspectRatio: '2 / 3', border: '3px dashed #c4b5fd', boxShadow: '0 0 0 9999px rgba(17, 6, 41, 0.45)' }} />
        ) : (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 rounded-lg pointer-events-none"
            style={{ border: '2px dashed rgba(255,255,255,0.7)' }} />
        )}
      </div>
      <p className="text-xs mt-3 text-center" style={{ color: '#ddd6fe' }}>
        {coverPhase ? t(coverStatus === 'pending' ? 'scan.looking' : 'scan.coverHint') : t('scan.hint')}
      </p>
      {error && <p className="text-sm mt-2 text-red-300">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        {coverPhase && (
          <button onClick={capture} className="px-6 py-2.5 rounded-xl font-bold text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            📸 {t('scan.shutter')}
          </button>
        )}
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#ffffff', color: '#2e1065' }}>
          {coverPhase ? t('scan.skipCover') : t('scan.close')}
        </button>
      </div>
    </div>
  );
}
