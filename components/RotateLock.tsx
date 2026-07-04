'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

// Shows a "rotate upright" overlay when a small (phone-sized) screen is held
// in landscape, effectively locking the app to portrait on phones.
export default function RotateLock() {
  const { t } = useI18n();
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const check = () => {
      const isPhone = window.innerHeight < 600 && window.innerWidth < 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      setLandscape(isPhone && isLandscape);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!landscape) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-center px-8"
      style={{ background: '#0f0f1a' }}
    >
      <div className="text-6xl mb-4 animate-pulse">📱</div>
      <p className="text-lg font-semibold text-white">{t('rotate.msg')}</p>
    </div>
  );
}
