'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

const KEY = 'irl-guide-collapsed';

// What to do when you actually go and swap the books. Open by default, because
// the first in-person trade is the one where a student has no idea what is
// expected; collapsed state is remembered so it stops being in the way after.
export default function IrlGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { setOpen(localStorage.getItem(KEY) !== '1'); } catch { /* private mode */ }
  }, []);

  function toggle() {
    setOpen(o => {
      try { localStorage.setItem(KEY, o ? '1' : '0'); } catch { /* ignore */ }
      return !o;
    });
  }

  const groups = [
    {
      icon: '🎒',
      title: t('guide.beforeTitle'),
      steps: [t('guide.before1'), t('guide.before2'), t('guide.before3')],
    },
    {
      icon: '📚',
      title: t('guide.meetTitle'),
      steps: [t('guide.meet1'), t('guide.meetTime'), t('guide.meet2'), t('guide.meet3')],
    },
    {
      icon: '✅',
      title: t('guide.afterTitle'),
      steps: [t('guide.after1'), t('guide.after2')],
    },
  ];

  return (
    <div className="rounded-2xl mb-6 overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <span className="font-bold text-[#2e1065]">📋 {t('guide.title')}</span>
        <span className="text-sm" style={{ color: '#7c3aed' }}>{open ? t('guide.hide') : t('guide.show')}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 bt-slide-in">
          <div className="flex flex-col gap-4">
            {groups.map((g, gi) => (
              <div key={gi}>
                <p className="text-sm font-bold mb-2" style={{ color: '#7c3aed' }}>{g.icon} {g.title}</p>
                <ol className="flex flex-col gap-2">
                  {g.steps.map((s, si) => (
                    <li key={si} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ background: '#ede9fe', color: '#7c3aed' }}>
                        {si + 1}
                      </span>
                      <span className="text-xs leading-relaxed text-[#4b5563]">{s}</span>
                    </li>
                  ))}
                </ol>
                {/* A photo beats a description here — "the library" still
                    leaves a first-timer unsure exactly where to stand. */}
                {g.title === t('guide.meetTitle') && (
                  <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #e9d5ff' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/meet-spot.jpg" alt={t('guide.meetSpotCaption')} className="w-full h-auto block" loading="lazy" />
                    <p className="text-xs font-semibold text-center py-2 px-3" style={{ background: '#faf5ff', color: '#7c3aed' }}>
                      📍 {t('guide.meetSpotCaption')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* The two things that need to be unmissable rather than step 7 of 8. */}
          <div className="mt-4 p-3 rounded-xl" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#b45309' }}>⚠️ {t('guide.safetyTitle')}</p>
            <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>{t('guide.safetyBody')}</p>
          </div>
          <div className="mt-2 p-3 rounded-xl" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#7c3aed' }}>🚫 {t('guide.problemTitle')}</p>
            <p className="text-xs leading-relaxed text-[#4b5563]">{t('guide.problemBody')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
