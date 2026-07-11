"use client";
import React, { useState, useTransition } from 'react';
import { PawPrint } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UserWidget from '@/components/UserWidget';
import { createClient } from '@/utils/supabase/client';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  context?: any[];
};

const NodesLogo = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 16L12 7L18 16" />
    <circle cx="6" cy="16" r="2" fill="currentColor" />
    <circle cx="12" cy="7" r="2" fill="currentColor" />
    <circle cx="18" cy="16" r="2" fill="currentColor" />
  </svg>
);

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [meta, setMeta] = useState("...");
  const [locationStr, setLocationStr] = useState("");
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { role: 'assistant', content: "hey, this is doobie. what brought you here today?" }
  ]);
  const [isChatPending, startChatTransition] = useTransition();

  const handleSave = () => {
    if (!content.trim() || isPending) return;
    
    startTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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

  const handleAskDoobie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatPending) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    startChatTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ query: userMessage })
      });
      const result = await res.json();
      
      if (!res.ok) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: result.detail || "Error connecting to Doobie." }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', content: result.answer, context: result.context }]);
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
    <main className="flex flex-col h-screen w-full bg-gradient-to-br from-gray-100 via-white to-gray-200 text-black overflow-hidden relative">
      
      {/* Decorative Background Elements for Glassmorphism */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-stone-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      </div>

      <UserWidget />
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

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

        {/* CHAT INTERFACE (Retrieve State) */}
        {isSidebarOpen && (
          <section className="w-1/3 flex flex-col border-l border-white/50 bg-white/60 backdrop-blur-2xl shadow-xl">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {chatHistory.map((msg, idx) => (
                <div key={idx} className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${msg.role === 'user' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {msg.role === 'user' ? 'You' : 'Doobie'}
                  </p>
                  <div className={`text-sm leading-relaxed p-3 rounded-lg border ${msg.role === 'user' ? 'text-gray-800 bg-white/50 shadow-sm border-white/60' : 'text-gray-700 bg-black/5 border-black/5'}`}>
                    <p>{msg.content}</p>
                    {msg.context && msg.context.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.context.map((c, i) => (
                          <span key={i} className="px-2 py-1 bg-white/80 text-[10px] font-mono rounded-md text-gray-600 shadow-sm border border-gray-100" title={c.content}>
                            [TRACE REF {i+1}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isChatPending && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Doobie</p>
                  <div className="text-sm leading-relaxed text-gray-700 bg-black/5 p-3 rounded-lg border border-black/5 animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleAskDoobie} className="p-4 bg-white/40 border-t border-white/50 flex gap-2 backdrop-blur-md">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatPending}
                placeholder="Ask Doobie about your entries..."
                className="flex-1 bg-white/70 border border-white/80 shadow-inner rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black/20 transition-all placeholder:text-gray-400"
              />
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
