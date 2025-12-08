import { FC } from 'react';
import Text from './Text';
import NavElement from './nav-element';

interface Props {
  children: React.ReactNode;
}

export const ContentContainer: React.FC<Props> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(236,72,153,0.2),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.22),transparent_35%)]" />
      <div className="relative w-full px-4 sm:px-8 lg:px-12 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 shadow-md" />
              <div>
                <Text variant="heading" className="leading-tight">
                  Solana Next
                </Text>
                <p className="text-xs text-slate-400">Mint & outils démos</p>
              </div>
            </div>
            <nav className="flex items-center gap-6 text-sm">
              <NavElement label="Home" href="/" />
              <NavElement label="Basics" href="/basics" />
            </nav>
          </header>

          <main className="mt-8 mb-12">{children}</main>
        </div>
      </div>
    </div>
  );
};
