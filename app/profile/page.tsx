'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import TopTabs from '@/components/TopTabs';
import MyBooksManager from '@/components/MyBooksManager';
import AdminHarvestCard from '@/components/AdminHarvestCard';
import { useSession } from '@/lib/session';

interface User {
  id: number;
  is_admin?: boolean;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const { user: sessionUser, loading: sessionLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) { router.push('/login'); return; }
    setUser(sessionUser as User);
  }, [router, sessionUser, sessionLoading]);

  if (!user) return (
    <>
      <Loading />
    </>
  );

  return (
    <>
      <main className="max-w-6xl 2xl:max-w-[110rem] mx-auto px-4 lg:px-8 py-6">
        <TopTabs />
        {user.is_admin && <AdminHarvestCard />}
        <MyBooksManager />
      </main>
    </>
  );
}
