'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, KeyRound, LogOut, Lock } from 'lucide-react';
import './globals.css';
import { api } from '@/lib/api-client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bt_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      } else {
        setCurrentUser(null);
      }
    } catch {
      // Ignore
    }
  }, [pathname]);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    router.push('/');
  };

  return (
    <html lang="en">
      <head>
        <title>BharatTunnel 🇮🇳 - India Exit VPN Gateway</title>
        <meta
          name="description"
          content="Ultra-secure, censorship-resistant India-exit WireGuard & AmneziaWG VPN gateway with 30-day student vouchers."
        />
      </head>
      <body className="bg-[#090D16] text-slate-100 flex flex-col min-h-screen">
        {/* Navigation Bar */}
        <header className="border-b border-slate-800 bg-[#0B0F19]/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-green-600 flex items-center justify-center p-[2px] shadow-lg shadow-orange-500/20">
                <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight flex items-center gap-1.5 text-white">
                  BharatTunnel <span className="text-sm">🇮🇳</span>
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
                  India Exit VPN Gateway
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
              <Link
                href="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === '/' ? 'text-orange-400 bg-orange-500/10' : 'text-slate-300 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4 text-orange-400" />
                <span>Claim Voucher</span>
              </Link>

              {currentUser?.role === 'ADMIN' && (
                <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-800">
                  <Link
                    href="/admin"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname.startsWith('/admin')
                        ? 'text-orange-400 bg-orange-500/10'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Admin Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </nav>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 bg-[#070A12] py-8 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400">BharatTunnel 🇮🇳</span>
              <span>•</span>
              <span>Mumbai-1 Gateway (137.23.44.209)</span>
              <span>•</span>
              <span>WireGuard & AmneziaWG (Anti-DPI)</span>
            </div>
            <p className="text-center sm:text-right">
              Ultra-secure private India-exit tunnels for Indian students & global users.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
