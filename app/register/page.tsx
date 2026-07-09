'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

const GRADES = ['1', '2', '3', '4', '5', '6'];
const CLASSES = Array.from({ length: 16 }, (_, i) => String(i + 1));
const DAYS = ['day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri'];
const SLOTS = [
  { key: 'p4', label: 'reg.slotP4' },
  { key: 'p5', label: 'reg.slotP5' },
  { key: 'after', label: 'reg.slotAfter' },
];

export default function RegisterPage() {
  const { t, gradeLabel } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [contact, setContact] = useState('');
  const [availability, setAvailability] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, grade, class_no: classNo, contact, availability }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/trade');
        return;
      }
      setError(data.error ?? t('reg.failed', { status: res.status }));
    } catch {
      setError(t('common.unreachable'));
    } finally {
      setLoading(false);
    }
  }

  function toggleSlot(key: string) {
    setAvailability(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📚</div>
            <h1 className="text-2xl font-bold text-[#2e1065]">{t('reg.join')}</h1>
            <p className="text-[#6b7280] text-sm mt-1">{t('reg.subtitle')}</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.yourName')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder="Alex Johnson"
              />
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder="your@school.edu"
              />
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder={t('reg.passwordHint')}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.gradeOptional')}</label>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: grade ? '#2e1065' : '#9ca3af', outline: 'none' }}
                >
                  <option value="">{t('reg.selectGrade')}</option>
                  {GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.classOptional')}</label>
                <select
                  value={classNo}
                  onChange={e => setClassNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: classNo ? '#2e1065' : '#9ca3af', outline: 'none' }}
                >
                  <option value="">{t('reg.selectClass')}</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.contactOptional')}</label>
              <input
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                maxLength={100}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder={t('reg.contactHint')}
              />
            </div>
            {/* Where trades happen + weekly availability */}
            <div className="p-3 rounded-xl" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <p className="text-sm font-bold text-[#2e1065] mb-1">{t('reg.libraryTitle')}</p>
              <p className="text-xs text-[#6b7280] leading-relaxed">{t('reg.libraryBody')}</p>
            </div>

            <div>
              <label className="text-sm text-[#4b5563] mb-1 block">{t('reg.availabilityTitle')}</label>
              <p className="text-xs text-[#9ca3af] mb-2">{t('reg.availabilityHint')}</p>
              <div className="overflow-x-auto">
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
                          const on = availability.includes(key);
                          return (
                            <td key={key} className="p-0.5">
                              <button
                                type="button"
                                onClick={() => toggleSlot(key)}
                                aria-pressed={on}
                                className="w-full rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                                style={{
                                  height: 34,
                                  background: on ? '#7c3aed' : '#ffffff',
                                  color: on ? '#ffffff' : '#c4b5fd',
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

            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {loading ? t('reg.creating') : t('reg.createAccount')}
            </button>
            <p className="text-center text-sm text-[#6b7280]">
              {t('reg.haveAccount')}{' '}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
                {t('login.signIn')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
