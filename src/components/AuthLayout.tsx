import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col h-screen w-full bg-white text-black overflow-hidden relative items-center justify-center">
      <div className="w-full max-w-[280px] space-y-8 bg-white mx-auto">
        <div className="flex items-center justify-center gap-3 pb-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-black">
            <path d="M6 16L12 7L18 16" />
            <circle cx="6" cy="16" r="2" fill="currentColor" />
            <circle cx="12" cy="7" r="2" fill="currentColor" />
            <circle cx="18" cy="16" r="2" fill="currentColor" />
          </svg>
          <h1 className="text-3xl font-black tracking-[0.15em] text-black pt-1 uppercase">TRACE</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
