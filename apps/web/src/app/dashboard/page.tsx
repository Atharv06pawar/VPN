'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bt_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.role === 'ADMIN') {
          router.replace('/admin');
          return;
        }
      }
    } catch {
      // Ignore
    }
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-xs">
      Redirecting to BharatTunnel portal...
    </div>
  );
}
