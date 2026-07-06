'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
import TopTabs from '@/components/TopTabs';
import MyBooksManager from '@/components/MyBooksManager';
import AdminHarvestCard from '@/components/AdminHarvestCard';

interface User {
  id: number;
  is_admin?: boolean;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setUser(d.user);
    });
  }, [router]);

  if (!user) return (
    <>
      <Navbar />
      <Loading />
    </>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <TopTabs />
        {user.is_admin && <AdminHarvestCard />}
        <MyBooksManager />
      </main>
    </>
  );
}
