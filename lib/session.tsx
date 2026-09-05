'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Who is signed in, fetched once for the whole app instead of per page.
//
// Every page used to ask /api/auth/me for itself, and the navbar asked again on
// every navigation — so a single tap cost two identical round trips before the
// page's own data was even requested. On a phone on school wifi, talking to a
// database in another country, that is the delay you feel when switching pages.

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  class_no?: string | null;
  avatar_color: string;
  contact?: string | null;
  availability?: string[];
  is_admin?: boolean;
  google_linked?: boolean;
}

interface SessionValue {
  user: SessionUser | null;
  /** True until the first answer arrives. Pages must not redirect to /login
   *  while this is true, or a signed-in student gets bounced on a slow link. */
  loading: boolean;
  /** Re-read the session from the server (after editing a profile, say). */
  refresh: () => Promise<SessionUser | null>;
  /** Apply a known-good user locally, avoiding a re-fetch. */
  setUser: (u: SessionUser | null) => void;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  loading: true,
  refresh: async () => null,
  setUser: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const d = res.ok ? await res.json() : { user: null };
      // A ban takes effect while the student is sitting on the page: the
      // server has already cleared the cookie, so drop them here too rather
      // than leaving a signed-in-looking site that refuses everything.
      if (d.banned) setBanned(true);
      setUser(d.user ?? null);
      return (d.user ?? null) as SessionUser | null;
    } catch {
      // Offline or a dropped request: keep whoever we already had rather than
      // reporting them signed out, which would redirect them to /login.
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Coming back to the tab re-checks who is signed in, so a session that
  // changed elsewhere — another tab, an expired cookie — does not leave this
  // one showing the wrong site until a reload. Throttled, because switching
  // tabs is not news.
  // Re-check on a timer as well as on focus. Somebody who has been banned
  // should stop being signed in while they are looking at the page, not the
  // next time they happen to switch tabs.
  useEffect(() => {
    const id = setInterval(() => { refresh(); }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ user, loading, refresh, setUser }}>
      {/* Said plainly, once: being signed out with no explanation is worse
          than being told why. */}
      {banned && (
        <div className="sticky top-0 z-[60]" style={{ background: '#7f1d1d', color: '#fff', textAlign: 'center', padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>
          บัญชีนี้ถูกระงับการใช้งาน — ติดต่อผู้ดูแลถ้าคิดว่าผิดพลาด · This account has been suspended. Contact the admin if you think this is a mistake.
        </div>
      )}
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
