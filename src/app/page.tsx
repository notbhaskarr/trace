"use client";
import React, { useState, useTransition } from 'react';
import { PawPrint } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UserWidget from '@/components/UserWidget';
import { createClient } from '@/utils/supabase/client';


const NodesLogo = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 16L12 7L18 16" />
    <circle cx="6" cy="16" r="2" fill="currentColor" />
    <circle cx="12" cy="7" r="2" fill="currentColor" />
    <circle cx="18" cy="16" r="2" fill="currentColor" />
  </svg>
);

export default function Dashboard() {
  const [meta, setMeta] = useState("...");
  const [locationStr, setLocationStr] = useState("");
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  // Safely grab the API URL and strip any accidental trailing slashes
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/$/, '');

  const handleSave = () => {
    if (!content.trim() || isPending) return;
    
    startTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/entries`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ content, location: locationStr })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.detail || "Failed to save");
      } else {
        setContent(""); // clear the editor on success
      }
    });
  };


  React.useEffect(() => {
    // ponytail: this internal edge route falls back to IP location on localhost, but uses native edge headers on vercel.
    fetch('/api/geo').then(r => r.json()).then(d => {
      const loc = `${d.city?.toUpperCase() || 'UNKNOWN'}, ${d.region || ''}`;
      setLocationStr(loc);
      setMeta(`${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • ${loc}`);
    }).catch(() => setMeta(`${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • OFFLINE`));
  }, []);

  return (
    <main className="flex flex-col h-full w-full overflow-hidden relative">
      
      <UserWidget />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* EDITOR INTERFACE (Dump State) */}
        <section className="flex-1 flex flex-col bg-white/40 backdrop-blur-xl">
          <header className="p-8 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">OCTOBER 14, 2024</h2>
              <p className="text-[10px] font-medium text-gray-500 mt-1">{meta}</p>
            </div>
          </header>

          <div className="flex-1 p-8 pt-4">
            <textarea
              className="w-full h-full resize-none bg-transparent text-base leading-loose focus:outline-none placeholder:text-gray-400 text-gray-800"
              placeholder="Start writing..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
            />
          </div>
          
          <div className="p-8 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={!content.trim() || isPending}
            className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving..." : "Leave a Trace"}
            {!isPending && <span className="text-lg leading-none transform group-hover:translate-x-1 transition-transform">&rarr;</span>}
          </button>
        </div>
        </section>
      </div>

    </main>
  );
}
