import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PawPrint } from 'lucide-react';
import { useChat } from './ChatProvider';

export default function Navbar() {
  const { toggleChat } = useChat();
  const pathname = usePathname();
  const isTimeline = pathname === '/timeline';
  return (
    <header className="relative z-20 w-full flex items-center justify-between p-6 px-8 border-b border-white/50 bg-white/40 backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-black">
          <path d="M6 16L12 7L18 16" />
          <circle cx="6" cy="16" r="2" fill="currentColor" />
          <circle cx="12" cy="7" r="2" fill="currentColor" />
          <circle cx="18" cy="16" r="2" fill="currentColor" />
        </svg>
        <Link href="/">
          <h1 className="text-lg font-black tracking-[0.15em] uppercase text-black pt-0.5 cursor-pointer hover:opacity-70 transition-opacity">TRACE</h1>
        </Link>
      </div>
      <div className="flex items-center gap-6">
        {isTimeline ? (
          <Link href="/">
             <span className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors cursor-pointer mr-2">New Entry</span>
          </Link>
        ) : (
          <Link href="/timeline">
             <span className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors cursor-pointer mr-2">Past Traces</span>
          </Link>
        )}
        
        <button 
          onClick={toggleChat}
          className="text-gray-400 hover:text-black transition-all flex items-center justify-center p-1.5 rounded-full hover:bg-black/5"
          title="Ask Doobie"
        >
          <PawPrint className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
