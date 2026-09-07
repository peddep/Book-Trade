'use client';

import { I18nProvider } from '@/lib/i18n';
import { SessionProvider } from '@/lib/session';
import { ThemeProvider } from '@/lib/theme';
import RotateLock from '@/components/RotateLock';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SessionProvider>
          <RotateLock />
          {children}
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
