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
  // How far the parent's lookup has got. The camera holds the barcode view
  // until this resolves, so the student never loses their aim before we know
  // whether the book was actually identified.
  status?: 'idle' | 'looking' | 'foundCover' | 'foundNoCover' | 'notFound';
  // Shown over the camera once we know what the book is.
  foundTitle?: string | null;
}

// Both ISBN forms carry a check digit. Verifying it is what separates "this is
// a book" from "this is a ten-digit number that happened to be on the cover" —
// a price label or a shop's own code would otherwise be accepted as an ISBN and
// then, of course, find nothing.
function ean13Ok(d: string): boolean {
  const n = d.split('').map(Number);
  const sum = n.slice(0, 12).reduce((a, v, i) => a + v * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === n[12];
}

function isbn10Ok(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  const last = d[9].toUpperCase();
  sum += last === 'X' ? 10 : Number(last);
  return sum % 11 === 0;
}

function isIsbn(text: string): string | null {
  const t = text.replace(/[^0-9Xx]/g, '');
  if (t.length === 13 && /^97[89]/.test(t) && ean13Ok(t)) return t;
  if (t.length === 10 && /^[0-9]{9}[0-9Xx]$/.test(t) && isbn10Ok(t)) return t;
  return null;
}

// Full-screen ISBN barcode scanner. Prefers the phone's native
// BarcodeDetector (fast and reliable on Android/Chrome); falls back to ZXing.
// Always requests the BACK camera at a usable resolution — the previous
// version often got the front camera, which is why scanning was hit-or-miss.
export default function BarcodeScanner({ onDetected, onClose, onCapture, status = 'idle', foundTitle }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  // scan → looking (barcode read, waiting on the lookup) → cover, or back to
  // scan when the lookup came up empty.
  const [phase, setPhase] = useState<'scan' | 'looking' | 'cover'>('scan');
  const [retryMsg, setRetryMsg] = useState('');
  // A barcode was read clearly but is not an ISBN — almost always the price or
  // shop code printed next to it. Saying so beats looking broken.
  const [wrongCode, setWrongCode] = useState(false);
  // Torch, where the device offers one. A school library is not a well-lit
  // studio, and dim light is the usual reason a scan will not take.
  const [torchOn, setTorchOn] = useState(false);
  const [torchable, setTorchable] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  // The last ISBN we looked up, so a failed lookup can be retried deliberately.
  const lastIsbnRef = useRef<string | null>(null);
  // Gates decoding. Set while a lookup is in flight so the same barcode isn't
  // read over and over, cleared to resume scanning.
  const doneRef = useRef(false);
  // Barcodes already looked up, so resuming after a miss doesn't instantly
  // re-read the same one and loop.
  const triedRef = useRef<Set<string>>(new Set());

  // Drive the flow off the parent's lookup rather than off the decode, so the
  // camera never moves on before we know what the book is.
  useEffect(() => {
    if (phase !== 'looking') return;
    if (status === 'foundNoCover') {
      setPhase('cover');
      return;
    }
    if (status === 'notFound') {
      // Keep the camera up and start reading again — most often the student
      // caught the wrong barcode (a price label, a different book).
      setRetryMsg(t('scan.notFoundRetry'));
      setPhase('scan');
      doneRef.current = false;
      return;
    }
    if (status === 'foundCover') {
      // Hold the title on screen for a moment so the scan visibly succeeded.
      const id = setTimeout(onClose, 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, status]);

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
      if (doneRef.current) return false;
      const isbn = isIsbn(text);
      if (!isbn) {
        // We are decoding something — it is just not a book number. Tell the
        // student, instead of leaving them pointing at a barcode that reads
        // perfectly well and produces nothing.
        setWrongCode(true);
        return false;
      }
      // Ignore a barcode we've already looked up, so resuming after a miss
      // doesn't immediately re-read the one still sitting in front of the lens.
      if (triedRef.current.has(isbn)) return false;
      doneRef.current = true;
      triedRef.current.add(isbn);
      lastIsbnRef.current = isbn;
      setWrongCode(false);
      setRetryMsg('');
      // Hold the camera here until the parent's lookup reports back.
      setPhase('looking');
      onDetected(isbn);
      return true;
    }

    // Continuous autofocus where the camera supports it, and note whether it
    // has a torch. Fixed focus at close range is the single biggest reason a
    // barcode reads on one phone and not on another.
    async function tuneCamera(s: MediaStream) {
      const track = s.getVideoTracks()[0];
      if (!track) return;
      trackRef.current = track;
      try {
        const caps: any = track.getCapabilities?.() ?? {};
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        }
        if ('torch' in caps) setTorchable(true);
      } catch { /* the camera does not take these; carry on without them */ }
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
          await tuneCamera(stream);
          // The loop keeps running for the life of the scanner and simply
          // skips decoding while a lookup is in flight, so scanning can resume
          // after a miss without restarting the camera.
          // Decoding every frame pins the CPU on a cheap phone, which drops
          // frames and blurs the very image being decoded. Ten looks a second
          // is far more than enough to catch a barcode held in front of a lens.
          let lastRun = 0;
          const tick = async (now: number) => {
            if (cancelled) return;
            if (!doneRef.current && now - lastRun > 100) {
              lastRun = now;
              try {
                const codes = await detector.detect(video);
                for (const c of codes) if (found(c.rawValue)) break;
              } catch { /* frame not ready */ }
            }
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
        // ZXing opened the camera itself, so pick the track up from the video.
        const zxStream = video.srcObject as MediaStream | null;
        if (zxStream) await tuneCamera(zxStream);
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

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch { setTorchable(false); }
  }

  // A lookup that came back empty is remembered, so the same barcode is not
  // read again on a loop. When the miss was a dropped request rather than an
  // unknown book, this is how the student tries the very same book again.
  function retryLast() {
    const isbn = lastIsbnRef.current;
    if (!isbn) return;
    triedRef.current.delete(isbn);
    doneRef.current = false;
    setRetryMsg('');
    setWrongCode(false);
  }

  const coverPhase = phase === 'cover';
  const lookingPhase = phase === 'looking';
  // The lookup has finished and told us what the book is.
  const identified = lookingPhase && (status === 'foundCover' || status === 'foundNoCover');

  const heading = coverPhase
    ? `✓ ${t('scan.coverStep')}`
    : identified
      ? `✓ ${foundTitle ?? ''}`
      : lookingPhase
        ? t('scan.looking')
        : `📷 ${t('scan.title')}`;

  const hint = coverPhase
    ? t('scan.coverHint')
    : lookingPhase
      ? t('scan.holdSteady')
      : retryMsg || (wrongCode ? t('scan.notIsbn') : t('scan.hint'));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4" style={{ background: 'rgba(17, 6, 41, 0.92)' }}>
      <p className="text-white font-bold mb-3 text-center px-2">{heading}</p>
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
            style={{ border: `2px dashed ${identified ? '#34d399' : 'rgba(255,255,255,0.7)'}` }} />
        )}
        {/* Working overlay — the camera stays visible underneath, so the
            student can keep the book in frame while the lookup runs. */}
        {lookingPhase && !identified && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(17, 6, 41, 0.55)' }}>
            <div className="w-10 h-10 rounded-full animate-spin"
              style={{ border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#c4b5fd' }} />
          </div>
        )}
      </div>
      <p className="text-xs mt-3 text-center max-w-sm" style={{ color: (retryMsg || wrongCode) && !lookingPhase && !coverPhase ? '#fca5a5' : '#ddd6fe' }}>{hint}</p>
      {error && <p className="text-sm mt-2 text-red-300">{error}</p>}
      <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
        {!coverPhase && torchable && (
          <button onClick={toggleTorch} className="px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: torchOn ? '#fbbf24' : 'rgba(255,255,255,0.15)', color: torchOn ? '#2e1065' : '#ffffff' }}>
            🔦 {t('scan.torch')}
          </button>
        )}
        {!coverPhase && !lookingPhase && retryMsg && lastIsbnRef.current && (
          <button onClick={retryLast} className="px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff' }}>
            ↻ {t('scan.retrySame')}
          </button>
        )}
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
