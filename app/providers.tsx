'use client';

import { I18nProvider } from '@/lib/i18n';
import RotateLock from '@/components/RotateLock';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <RotateLock />
      {children}
    </I18nProvider>
  );
}
