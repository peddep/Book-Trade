'use client';

import { useI18n } from '@/lib/i18n';

export const DAYS = ['day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri'];
export const SLOTS = [
  { key: 'p4', label: 'reg.slotP4' },
  { key: 'p5', label: 'reg.slotP5' },
  { key: 'after', label: 'reg.slotAfter' },
];
// Free whenever the other person is. Lunch is staggered by year here, so two
// students in different years can easily share no slot at all; this gives them
// a way to say the grid is not the real constraint for them.
export const ANY = 'any';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

// The weekly free-period picker, shared by registration and the profile editor
// so the two can never drift apart.
export default function AvailabilityGrid({ value, onChange }: Props) {
  const { t } = useI18n();
  const flexible = value.includes(ANY);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(ANY)}
        aria-pressed={flexible}
        className="w-full mb-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-left bt-press"
        style={flexible
          ? { background: '#7c3aed', color: '#ffffff', border: '1px solid #7c3aed' }
          : { background: '#faf5ff', color: '#4b5563', border: '1px solid #e9d5ff' }}
      >
        {flexible ? '✓ ' : ''}⏰ {t('avail.any')}
        <span className="block text-[11px] font-normal mt-0.5" style={{ color: flexible ? 'rgba(255,255,255,0.8)' : '#9ca3af' }}>
          {t('avail.anyHint')}
        </span>
      </button>

      <div className="overflow-x-auto" style={{ opacity: flexible ? 0.45 : 1 }}>
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="p-1"></th>
              {DAYS.map(d => (
                <th key={d} className="p-1 text-xs font-semibold text-[#7c3aed]">{t(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map(slot => (
              <tr key={slot.key}>
                <td className="p-1 text-[11px] text-left font-semibold text-[#4b5563] whitespace-nowrap pr-2">{t(slot.label)}</td>
                {DAYS.map((_, col) => {
                  const key = `${slot.key}-${col}`;
                  const on = value.includes(key);
                  return (
                    <td key={key} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-pressed={on}
                        aria-label={key}
                        className="w-full rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                        style={{
                          height: 34,
                          background: on ? '#7c3aed' : '#faf5ff',
                          color: on ? '#ffffff' : '#d1d5db',
                          border: `1px solid ${on ? '#7c3aed' : '#e9d5ff'}`,
                        }}
                      >
                        {on ? '✓' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
