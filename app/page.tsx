import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0f0f1a 100%)' }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 50%)' }}
          />
          <div className="max-w-4xl mx-auto px-4 py-24 text-center relative z-10">
            <div className="text-7xl mb-6">📚</div>
            <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
              Trade Books With<br />
              <span style={{ background: 'linear-gradient(135deg, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Your Classmates
              </span>
            </h1>
            <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
              Like Pokémon Home, but for textbooks and novels. List your books, discover what others have, and trade right at school.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="px-8 py-3 rounded-xl font-bold text-white text-lg"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                Start Trading →
              </Link>
              <Link
                href="/books"
                className="px-8 py-3 rounded-xl font-bold text-slate-200 text-lg"
                style={{ background: '#2d2d4a' }}
              >
                Browse Books
              </Link>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center text-white mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📝', title: 'List Your Books', desc: 'Add books you want to trade away — textbooks, novels, anything.' },
              { icon: '🔍', title: 'Find What You Want', desc: 'Browse your classmates\' collections. Filter by subject or grade.' },
              { icon: '🤝', title: 'Offer a Trade', desc: 'Propose a swap. If they accept, meet up at school and exchange!' },
            ].map((step, i) => (
              <div key={i} className="text-center p-6 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Conditions legend */}
        <div className="max-w-5xl mx-auto px-4 pb-20">
          <div className="rounded-2xl p-6" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
            <h3 className="font-bold text-white mb-4">Book Condition Guide</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Like New', color: '#10b981', desc: 'No marks, barely used' },
                { label: 'Good', color: '#3b82f6', desc: 'Minor wear, clean pages' },
                { label: 'Fair', color: '#f59e0b', desc: 'Some highlights/notes' },
                { label: 'Poor', color: '#ef4444', desc: 'Heavy wear, still readable' },
              ].map(c => (
                <div key={c.label} className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: c.color }} />
                  <div>
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-xs text-slate-400">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
