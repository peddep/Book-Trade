'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

const GRADES = ['6', '7', '8', '9', '10', '11', '12'];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, grade }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push('/profile');
    } else {
      setError(data.error ?? 'Registration failed');
    }
    setLoading(false);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📚</div>
            <h1 className="text-2xl font-bold text-white">Join BookTrade</h1>
            <p className="text-slate-400 text-sm mt-1">Start trading books with your classmates</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                placeholder="Alex Johnson"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                placeholder="your@school.edu"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Grade (optional)</label>
              <select
                value={grade}
                onChange={e => setGrade(e.target.value)}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: grade ? '#e2e8f0' : '#64748b', outline: 'none' }}
              >
                <option value="">Select your grade</option>
                {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <p className="text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
